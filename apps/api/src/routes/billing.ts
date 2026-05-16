import type { FastifyInstance } from "fastify";
import { BetaEventSource, BetaEventType } from "@prisma/client";

import { badRequest } from "../lib/httpErrors.js";
import { resolveCurrentUser } from "../plugins/currentUser.js";
import { checkoutSessionSchema } from "../schemas/billing.js";
import {
  constructBillingWebhookEvent,
  createBillingPortalSession,
  createCheckoutSession,
  getBillingStatus,
  handleStripeWebhook,
} from "../services/billingService.js";
import { recordBetaEvent } from "../services/betaEventService.js";

export async function registerBillingRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/billing/status", async (request) => {
    const user = await resolveCurrentUser(request);
    return getBillingStatus(user.id);
  });

  server.post("/v1/billing/create-checkout-session", async (request) => {
    const user = await resolveCurrentUser(request);
    const body = checkoutSessionSchema.parse(request.body);
    const session = await createCheckoutSession(user, body.interval);
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.BILLING_CHECKOUT_STARTED,
      source: BetaEventSource.API,
      metadata: { interval: body.interval, sessionId: session.sessionId },
    });
    return session;
  });

  server.post("/v1/billing/create-portal-session", async (request) => {
    const user = await resolveCurrentUser(request);
    return createBillingPortalSession(user.id);
  });

  server.post("/v1/billing/webhook", async (request) => {
    const signature = request.headers["stripe-signature"];
    const signatureValue = Array.isArray(signature) ? signature[0] : signature;
    if (!signatureValue) {
      throw badRequest("Missing Stripe signature.");
    }
    const rawBody =
      (request as typeof request & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(request.body ?? {}));
    const event = constructBillingWebhookEvent(rawBody, signatureValue);
    await handleStripeWebhook(event);
    return { received: true };
  });
}
