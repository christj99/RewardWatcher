import Stripe from "stripe";

import { env } from "../config/env.js";
import { badRequest } from "../lib/httpErrors.js";

export type CheckoutInterval = "ANNUAL" | "MONTHLY";

export type StripeClient = {
  createCustomer(input: {
    email: string;
    name?: string | null;
    metadata?: Record<string, string>;
  }): Promise<{ id: string }>;
  createCheckoutSession(input: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<{ id: string; url: string | null }>;
  createBillingPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ id: string; url: string }>;
  retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
  constructWebhookEvent(
    rawBody: string | Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event;
};

let testClient: StripeClient | null = null;
let stripeSdk: Stripe | null = null;

export function setStripeClientForTesting(client: StripeClient | null): void {
  testClient = client;
}

export function assertStripeConfigured(): void {
  if (!env.STRIPE_SECRET_KEY) {
    throw badRequest("Stripe is not configured for this environment.");
  }
}

export function assertStripeWebhookConfigured(): void {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw badRequest("Stripe webhook verification is not configured.");
  }
}

export function getStripeClient(): StripeClient {
  if (testClient) {
    return testClient;
  }
  assertStripeConfigured();
  const stripe = getStripeSdk();
  return {
    createCustomer: (input) =>
      stripe.customers.create({
        email: input.email,
        ...(input.name ? { name: input.name } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      }),
    createCheckoutSession: (input) => {
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        customer: input.customerId,
        line_items: [{ price: input.priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        ...(input.metadata
          ? {
              metadata: input.metadata,
              subscription_data: { metadata: input.metadata },
            }
          : {}),
      };
      return stripe.checkout.sessions.create(params);
    },
    createBillingPortalSession: (input) =>
      stripe.billingPortal.sessions.create({
        customer: input.customerId,
        return_url: input.returnUrl,
      }),
    retrieveSubscription: (subscriptionId) =>
      stripe.subscriptions.retrieve(subscriptionId),
    constructWebhookEvent: (rawBody, signature, webhookSecret) =>
      stripe.webhooks.constructEvent(rawBody, signature, webhookSecret),
  };
}

function getStripeSdk(): Stripe {
  if (!stripeSdk) {
    stripeSdk = new Stripe(env.STRIPE_SECRET_KEY ?? "", {
      apiVersion: "2024-06-20",
    });
  }
  return stripeSdk;
}
