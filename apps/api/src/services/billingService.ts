import {
  StripeWebhookStatus,
  SubscriptionStatus,
  type Prisma,
  type User,
} from "@prisma/client";
import type Stripe from "stripe";

import { prisma } from "@rewards-audit/db";

import { env } from "../config/env.js";
import { badRequest, notFound } from "../lib/httpErrors.js";
import { getPlanSummary } from "./entitlementService.js";
import { captureException } from "./observability/errorReporter.js";
import {
  assertStripeWebhookConfigured,
  getStripeClient,
  type CheckoutInterval,
} from "./stripeClient.js";

export async function getBillingStatus(userId: string) {
  const plan = await getPlanSummary(userId);
  const stripeCustomerId = plan.subscription?.stripeCustomerId ?? null;
  return {
    stripeCustomerId,
    subscription: plan.subscription,
    plan: plan.plan,
    entitlements: plan.entitlements,
    grants: plan.grants,
    checkoutAvailable: Boolean(
      env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID_ANNUAL,
    ),
    portalAvailable: Boolean(stripeCustomerId && env.STRIPE_SECRET_KEY),
  };
}

export async function createCheckoutSession(
  user: User,
  interval: CheckoutInterval,
) {
  const priceId = priceIdForInterval(interval);
  if (!priceId) {
    throw badRequest(
      `Stripe ${interval.toLowerCase()} price is not configured.`,
    );
  }

  const client = getStripeClient();
  let subscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      stripeCustomerId: { not: null },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  let stripeCustomerId = subscription?.stripeCustomerId ?? null;
  if (!stripeCustomerId) {
    const customer = await client.createCustomer({
      email: user.email,
      name: user.displayName,
      metadata: { userId: user.id },
    });
    stripeCustomerId = customer.id;
    subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeCustomerId,
        status: SubscriptionStatus.NONE,
      },
    });
  }
  if (!subscription) {
    throw badRequest("Could not prepare local subscription record.");
  }
  const localSubscriptionId = subscription.id;

  const session = await client.createCheckoutSession({
    customerId: stripeCustomerId,
    priceId,
    successUrl: env.STRIPE_CHECKOUT_SUCCESS_URL,
    cancelUrl: env.STRIPE_CHECKOUT_CANCEL_URL,
    metadata: {
      userId: user.id,
      subscriptionId: localSubscriptionId,
      interval,
    },
  });

  if (!session.url) {
    throw badRequest("Stripe did not return a checkout URL.");
  }

  return { url: session.url, sessionId: session.id };
}

export async function createBillingPortalSession(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      stripeCustomerId: { not: null },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
  if (!subscription?.stripeCustomerId) {
    throw notFound("No Stripe customer exists for this user.");
  }

  const session = await getStripeClient().createBillingPortalSession({
    customerId: subscription.stripeCustomerId,
    returnUrl: env.STRIPE_BILLING_PORTAL_RETURN_URL,
  });
  return { url: session.url };
}

export function constructBillingWebhookEvent(
  rawBody: string | Buffer,
  signature: string,
) {
  assertStripeWebhookConfigured();
  return getStripeClient().constructWebhookEvent(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET ?? "",
  );
}

export async function handleStripeWebhook(event: Stripe.Event) {
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing?.status === StripeWebhookStatus.PROCESSED) {
    return { duplicate: true, processed: true };
  }

  const eventRow =
    existing ??
    (await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        status: StripeWebhookStatus.RECEIVED,
      },
    }));

  try {
    await processStripeEvent(event);
    await prisma.stripeWebhookEvent.update({
      where: { id: eventRow.id },
      data: {
        status: StripeWebhookStatus.PROCESSED,
        processedAt: new Date(),
        errorMessage: null,
      },
    });
    return { duplicate: false, processed: true };
  } catch (error) {
    captureException(error, {
      stripeEventId: event.id,
      stripeEventType: event.type,
    });
    await prisma.stripeWebhookEvent.update({
      where: { id: eventRow.id },
      data: {
        status: StripeWebhookStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await processCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscriptionFromStripe(
        event.data.object as Stripe.Subscription,
      );
      return;
    case "customer.subscription.deleted":
      await upsertSubscriptionFromStripe(
        event.data.object as Stripe.Subscription,
        SubscriptionStatus.CANCELED,
      );
      return;
    case "invoice.payment_failed":
      await markInvoiceSubscriptionPastDue(event.data.object as Stripe.Invoice);
      return;
    default:
      return;
  }
}

async function processCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  const customerId = stringId(session.customer);
  const subscriptionId = stringId(session.subscription);
  if (!userId || !customerId) {
    throw badRequest("Stripe checkout session is missing user metadata.");
  }

  if (subscriptionId) {
    const subscription =
      await getStripeClient().retrieveSubscription(subscriptionId);
    await upsertSubscriptionFromStripe(subscription, undefined, userId);
    return;
  }

  await prisma.subscription.upsert({
    where: { stripeCustomerId: customerId },
    update: { userId, status: SubscriptionStatus.ACTIVE },
    create: {
      userId,
      stripeCustomerId: customerId,
      status: SubscriptionStatus.ACTIVE,
    },
  });
}

async function markInvoiceSubscriptionPastDue(
  invoice: Stripe.Invoice,
): Promise<void> {
  const subscriptionId = stringId(invoice.subscription);
  if (!subscriptionId) {
    return;
  }
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: SubscriptionStatus.PAST_DUE },
  });
}

async function upsertSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  forcedStatus?: SubscriptionStatus,
  fallbackUserId?: string,
) {
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = stringId(subscription.customer);
  const userId =
    fallbackUserId ??
    subscription.metadata?.userId ??
    (stripeCustomerId
      ? (
          await prisma.subscription.findUnique({
            where: { stripeCustomerId },
            select: { userId: true },
          })
        )?.userId
      : undefined);
  if (!userId) {
    throw notFound("Could not match Stripe subscription to a local user.");
  }

  const data = stripeSubscriptionToLocal(
    subscription,
    forcedStatus ?? mapStripeSubscriptionStatus(subscription.status),
  );
  return prisma.subscription.upsert({
    where: { stripeSubscriptionId },
    update: data,
    create: {
      ...data,
      userId,
      stripeSubscriptionId,
      stripeCustomerId,
    },
  });
}

type LocalSubscriptionData = {
  stripeCustomerId: string | null;
  status: SubscriptionStatus;
  priceId: string | null;
  productId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialStart: Date | null;
  trialEnd: Date | null;
  canceledAt: Date | null;
  metadata: Prisma.InputJsonValue;
};

function stripeSubscriptionToLocal(
  subscription: Stripe.Subscription,
  status: SubscriptionStatus,
): LocalSubscriptionData {
  const price = subscription.items.data[0]?.price;
  return {
    stripeCustomerId: stringId(subscription.customer),
    status,
    priceId: price?.id ?? null,
    productId: price ? stringId(price.product) : null,
    currentPeriodStart: fromUnix(subscription.current_period_start),
    currentPeriodEnd: fromUnix(subscription.current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    trialStart: fromUnix(subscription.trial_start),
    trialEnd: fromUnix(subscription.trial_end),
    canceledAt: fromUnix(subscription.canceled_at),
    metadata: (subscription.metadata ?? {}) as Prisma.InputJsonValue,
  };
}

export function mapStripeSubscriptionStatus(
  status: string,
): SubscriptionStatus {
  switch (status) {
    case "incomplete":
      return SubscriptionStatus.INCOMPLETE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "unpaid":
      return SubscriptionStatus.UNPAID;
    case "paused":
      return SubscriptionStatus.PAUSED;
    default:
      return SubscriptionStatus.NONE;
  }
}

function priceIdForInterval(interval: CheckoutInterval): string | undefined {
  return interval === "ANNUAL"
    ? env.STRIPE_PRICE_ID_ANNUAL
    : env.STRIPE_PRICE_ID_MONTHLY;
}

function stringId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : (value.id ?? null);
}

function fromUnix(value: number | null | undefined): Date | null {
  return value ? new Date(value * 1000) : null;
}
