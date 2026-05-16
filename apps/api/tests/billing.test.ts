import {
  EntitlementKey,
  EntitlementSource,
  SubscriptionStatus,
} from "@prisma/client";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../src/config/env.js";
import {
  getPlanSummary,
  requireEntitlement,
} from "../src/services/entitlementService.js";
import {
  setStripeClientForTesting,
  type StripeClient,
} from "../src/services/stripeClient.js";
import { buildSeededServer, prisma } from "./testUtils.js";

const originalStripeConfig = {
  STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_ID_ANNUAL: env.STRIPE_PRICE_ID_ANNUAL,
  STRIPE_PRICE_ID_MONTHLY: env.STRIPE_PRICE_ID_MONTHLY,
};

describe("billing and entitlements", () => {
  beforeEach(() => {
    env.STRIPE_SECRET_KEY = "sk_test_mock";
    env.STRIPE_WEBHOOK_SECRET = "whsec_mock";
    env.STRIPE_PRICE_ID_ANNUAL = "price_annual";
    env.STRIPE_PRICE_ID_MONTHLY = undefined;
  });

  afterEach(() => {
    setStripeClientForTesting(null);
    env.STRIPE_SECRET_KEY = originalStripeConfig.STRIPE_SECRET_KEY;
    env.STRIPE_WEBHOOK_SECRET = originalStripeConfig.STRIPE_WEBHOOK_SECRET;
    env.STRIPE_PRICE_ID_ANNUAL = originalStripeConfig.STRIPE_PRICE_ID_ANNUAL;
    env.STRIPE_PRICE_ID_MONTHLY = originalStripeConfig.STRIPE_PRICE_ID_MONTHLY;
  });

  it("seed grants beta access while free user stays free", async () => {
    await buildSeededServer().then((server) => server.close());
    const beta = await prisma.user.findUniqueOrThrow({
      where: { email: "beta@example.com" },
    });
    const free = await prisma.user.findUniqueOrThrow({
      where: { email: "free@example.com" },
    });

    const betaPlan = await getPlanSummary(beta.id);
    const freePlan = await getPlanSummary(free.id);

    expect(betaPlan.plan).toBe("BETA_GRANT");
    expect(betaPlan.entitlements.FULL_TRANSACTION_AUDIT).toBe(true);
    expect(freePlan.plan).toBe("FREE");
    expect(freePlan.entitlements.BASIC_RECOMMENDATIONS).toBe(true);
    expect(freePlan.entitlements.FULL_TRANSACTION_AUDIT).toBe(false);
    expect(freePlan.entitlements.WEEKLY_AUDIT_REPORT).toBe(false);
    expect(freePlan.entitlements.STATEMENT_CREDIT_TRACKING).toBe(false);
    expect(freePlan.entitlements.OFFER_AWARE_RECOMMENDATIONS).toBe(false);
    expect(freePlan.entitlements.ADVANCED_LENSES).toBe(false);
    expect(freePlan.entitlements.PLAID_SYNC).toBe(false);
    expect(freePlan.entitlements.EXTENDED_HISTORY).toBe(false);
  });

  it("active, trialing, and canceled subscriptions produce expected plans", async () => {
    await buildSeededServer().then((server) => server.close());
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const activeUser = await prisma.user.upsert({
      where: { email: `phase16-paid-active-${unique}@example.com` },
      update: {},
      create: { email: `phase16-paid-active-${unique}@example.com` },
    });
    await prisma.subscription.create({
      data: {
        userId: activeUser.id,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: `cus_${unique}`,
        stripeSubscriptionId: `sub_${unique}`,
      },
    });
    expect((await getPlanSummary(activeUser.id)).plan).toBe("PREMIUM");

    const trialingUser = await prisma.user.create({
      data: { email: `phase16-paid-trialing-${unique}@example.com` },
    });
    await prisma.subscription.create({
      data: {
        userId: trialingUser.id,
        status: SubscriptionStatus.TRIALING,
        stripeCustomerId: `cus_trialing_${unique}`,
        stripeSubscriptionId: `sub_trialing_${unique}`,
      },
    });
    const trialingPlan = await getPlanSummary(trialingUser.id);
    expect(trialingPlan.plan).toBe("PREMIUM");
    expect(trialingPlan.entitlements.PLAID_SYNC).toBe(true);

    const canceledUser = await prisma.user.create({
      data: { email: `phase16-paid-canceled-${unique}@example.com` },
    });
    await prisma.subscription.create({
      data: {
        userId: canceledUser.id,
        status: SubscriptionStatus.CANCELED,
        stripeCustomerId: `cus_canceled_${unique}`,
        stripeSubscriptionId: `sub_canceled_${unique}`,
      },
    });
    const canceledPlan = await getPlanSummary(canceledUser.id);
    expect(canceledPlan.plan).toBe("FREE");
    expect(canceledPlan.entitlements.BASIC_RECOMMENDATIONS).toBe(true);
    expect(canceledPlan.entitlements.FULL_TRANSACTION_AUDIT).toBe(false);
  });

  it("manual and founding beta grants produce expected entitlements", async () => {
    await buildSeededServer().then((server) => server.close());
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const grantUser = await prisma.user.upsert({
      where: { email: `phase16-grant-${unique}@example.com` },
      update: {},
      create: { email: `phase16-grant-${unique}@example.com` },
    });
    await prisma.entitlementGrant.create({
      data: {
        userId: grantUser.id,
        key: EntitlementKey.PLAID_SYNC,
        source: EntitlementSource.MANUAL_GRANT,
      },
    });
    await prisma.entitlementGrant.create({
      data: {
        userId: grantUser.id,
        key: EntitlementKey.WEEKLY_AUDIT_REPORT,
        source: EntitlementSource.MANUAL_GRANT,
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      },
    });
    const grantPlan = await getPlanSummary(grantUser.id);
    expect(grantPlan.plan).toBe("BETA_GRANT");
    expect(grantPlan.entitlements.PLAID_SYNC).toBe(true);
    expect(grantPlan.entitlements.WEEKLY_AUDIT_REPORT).toBe(false);

    const beta = await prisma.user.findUniqueOrThrow({
      where: { email: "beta@example.com" },
    });
    const betaPlan = await getPlanSummary(beta.id);
    expect(betaPlan.plan).toBe("BETA_GRANT");
    expect(betaPlan.entitlements.EXTENDED_HISTORY).toBe(true);
  });

  it("requireEntitlement throws the expected entitlement error", async () => {
    await buildSeededServer().then((server) => server.close());
    const free = await prisma.user.findUniqueOrThrow({
      where: { email: "free@example.com" },
    });

    await expect(
      requireEntitlement(free.id, EntitlementKey.PLAID_SYNC),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "ENTITLEMENT_REQUIRED",
      details: { entitlement: EntitlementKey.PLAID_SYNC },
    });
  });

  it("returns billing status and creates checkout and portal sessions with mocked Stripe", async () => {
    const server = await buildSeededServer();
    const stripe = mockStripeClient();
    setStripeClientForTesting(stripe);

    const freeStatus = await server.inject({
      method: "GET",
      url: "/v1/billing/status",
      headers: { "x-user-email": "free@example.com" },
    });
    const checkout = await server.inject({
      method: "POST",
      url: "/v1/billing/create-checkout-session",
      headers: { "x-user-email": "free@example.com" },
      payload: { interval: "ANNUAL" },
    });
    const portal = await server.inject({
      method: "POST",
      url: "/v1/billing/create-portal-session",
      headers: { "x-user-email": "free@example.com" },
    });
    const monthly = await server.inject({
      method: "POST",
      url: "/v1/billing/create-checkout-session",
      headers: { "x-user-email": "free@example.com" },
      payload: { interval: "MONTHLY" },
    });

    expect(freeStatus.json().plan).toBe("FREE");
    expect(checkout.statusCode).toBe(200);
    expect(checkout.json().url).toBe("https://stripe.test/checkout");
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: "price_annual",
        metadata: expect.objectContaining({ userId: expect.any(String) }),
      }),
    );
    expect(portal.json().url).toBe("https://stripe.test/portal");
    expect(monthly.statusCode).toBe(400);

    await server.close();
  });

  it("processes Stripe webhooks idempotently without dev auth", async () => {
    const server = await buildSeededServer();
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "free@example.com" },
    });
    const event = {
      id: `evt_phase16_${Date.now()}`,
      type: "customer.subscription.updated",
      data: {
        object: stripeSubscription({
          userId: user.id,
          status: "active",
          customerId: "cus_webhook",
          subscriptionId: "sub_webhook",
        }),
      },
    };
    const stripe = mockStripeClient(event);
    setStripeClientForTesting(stripe);

    const first = await server.inject({
      method: "POST",
      url: "/v1/billing/webhook",
      headers: { "stripe-signature": "valid" },
      payload: { ok: true },
    });
    const second = await server.inject({
      method: "POST",
      url: "/v1/billing/webhook",
      headers: { "stripe-signature": "valid" },
      payload: { ok: true },
    });

    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: "sub_webhook" },
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(subscription?.status).toBe("ACTIVE");
    expect(
      await prisma.stripeWebhookEvent.count({
        where: { stripeEventId: event.id },
      }),
    ).toBe(1);

    await server.close();
  });

  it("gates premium endpoints with entitlement errors", async () => {
    const server = await buildSeededServer();
    const weekly = await server.inject({
      method: "GET",
      url: "/v1/audit/weekly",
      headers: { "x-user-email": "free@example.com" },
    });
    const outcomes = await server.inject({
      method: "GET",
      url: "/v1/outcomes",
      headers: { "x-user-email": "free@example.com" },
    });
    const audit = await server.inject({
      method: "POST",
      url: "/v1/transactions/some-id/audit",
      headers: { "x-user-email": "free@example.com" },
    });
    const importWithoutAudit = await server.inject({
      method: "POST",
      url: "/v1/transactions/import",
      headers: { "x-user-email": "free@example.com" },
      payload: {
        audit: false,
        transactions: [
          {
            rawMerchantName: "Target",
            amountCents: 1200,
            transactionDate: "2026-01-02T00:00:00.000Z",
          },
        ],
      },
    });
    const advancedLens = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      headers: { "x-user-email": "free@example.com" },
      payload: {
        merchantName: "Target",
        lens: "ASPIRATIONAL",
      },
    });

    expect(weekly.statusCode).toBe(403);
    expect(weekly.json().error.code).toBe("ENTITLEMENT_REQUIRED");
    expect(weekly.json().error.details.entitlement).toBe("WEEKLY_AUDIT_REPORT");
    expect(outcomes.statusCode).toBe(403);
    expect(audit.statusCode).toBe(403);
    expect(importWithoutAudit.statusCode).toBe(201);
    expect(advancedLens.statusCode).toBe(403);
    expect(advancedLens.json().error.details.entitlement).toBe(
      "ADVANCED_LENSES",
    );

    await server.close();
  });

  it("lets admins list users and grant/deactivate entitlements", async () => {
    const server = await buildSeededServer();
    const email = `phase16-admin-grant-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;
    const user = await prisma.user.create({
      data: { email, displayName: "Phase 16 Admin Grant" },
    });
    const grant = await server.inject({
      method: "POST",
      url: "/v1/admin/entitlements/grant",
      headers: { "x-user-email": "admin@example.com" },
      payload: {
        userId: user.id,
        key: "WEEKLY_AUDIT_REPORT",
        source: "MANUAL_GRANT",
        notes: "Private beta support.",
      },
    });
    const list = await server.inject({
      method: "GET",
      url: `/v1/admin/billing/users?q=${encodeURIComponent(email)}`,
      headers: { "x-user-email": "admin@example.com" },
    });
    const inactive = await server.inject({
      method: "PATCH",
      url: `/v1/admin/entitlements/${grant.json().id}`,
      headers: { "x-user-email": "admin@example.com" },
      payload: { active: false },
    });
    const nonAdmin = await server.inject({
      method: "GET",
      url: "/v1/admin/billing/users",
      headers: { "x-user-email": "free@example.com" },
    });

    expect(grant.statusCode).toBe(201);
    expect(list.json()[0].email).toBe(email);
    expect(inactive.statusCode).toBe(200);
    expect(inactive.json().active).toBe(false);
    expect(nonAdmin.statusCode).toBe(403);
    expect(
      await prisma.adminAuditLog.count({
        where: { entityType: "EntitlementGrant", entityId: grant.json().id },
      }),
    ).toBeGreaterThanOrEqual(2);

    await server.close();
  });
});

function mockStripeClient(event?: unknown): StripeClient {
  return {
    createCustomer: vi.fn(async () => ({ id: "cus_mock" })),
    createCheckoutSession: vi.fn(async () => ({
      id: "cs_mock",
      url: "https://stripe.test/checkout",
    })),
    createBillingPortalSession: vi.fn(async () => ({
      id: "bps_mock",
      url: "https://stripe.test/portal",
    })),
    retrieveSubscription: vi.fn(async (subscriptionId) =>
      stripeSubscription({
        userId: "unused",
        status: "active",
        customerId: "cus_mock",
        subscriptionId,
      }),
    ),
    constructWebhookEvent: vi.fn(() => event as Stripe.Event),
  };
}

function stripeSubscription(input: {
  userId: string;
  status: string;
  customerId: string;
  subscriptionId: string;
}) {
  return {
    id: input.subscriptionId,
    customer: input.customerId,
    status: input.status,
    metadata: { userId: input.userId },
    current_period_start: 1_767_225_600,
    current_period_end: 1_769_904_000,
    cancel_at_period_end: false,
    trial_start: null,
    trial_end: null,
    canceled_at: null,
    items: {
      data: [
        {
          price: {
            id: "price_annual",
            product: "prod_rewards_audit",
          },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}
