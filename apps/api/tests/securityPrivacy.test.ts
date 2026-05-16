import { afterEach, describe, expect, it, vi } from "vitest";

import { redactSensitive } from "../src/lib/redaction.js";
import { resetRateLimitBucketsForTests } from "../src/plugins/rateLimit.js";
import { setErrorReporterForTesting } from "../src/services/observability/errorReporter.js";
import { buildSeededServer, prisma } from "./testUtils.js";

describe("security and privacy hardening", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRateLimitEnabled = process.env.RATE_LIMIT_ENABLED;
  const originalRateLimitMax = process.env.RATE_LIMIT_MAX;

  afterEach(() => {
    vi.restoreAllMocks();
    setErrorReporterForTesting(null);
    resetRateLimitBucketsForTests();
    process.env.NODE_ENV = originalNodeEnv;
    restoreEnv("RATE_LIMIT_ENABLED", originalRateLimitEnabled);
    restoreEnv("RATE_LIMIT_MAX", originalRateLimitMax);
  });

  it("redacts nested sensitive fields without mutating input", () => {
    const input = {
      email: "beta@example.com",
      safe: "kept",
      headers: { authorization: "Bearer secret", cookie: "sid=1" },
      plaid: { access_token: "access", account_id: "account" },
      nested: [{ publicToken: "public", mask: "1234" }],
    };

    const redacted = redactSensitive(input) as typeof input;

    expect(redacted.safe).toBe("kept");
    expect(redacted.email).toBe("[REDACTED]");
    expect(redacted.headers.authorization).toBe("[REDACTED]");
    expect(redacted.headers.cookie).toBe("[REDACTED]");
    expect(redacted.plaid).toBe("[REDACTED]");
    expect(redacted.nested[0]?.publicToken).toBe("[REDACTED]");
    expect(redacted.nested[0]?.mask).toBe("**34");
    expect(input.email).toBe("beta@example.com");
  });

  it("sets security headers and production errors omit stack details", async () => {
    process.env.NODE_ENV = "production";
    const server = await buildSeededServer();
    server.get("/test-boom", async () => {
      throw new Error("sensitive stack detail");
    });

    const health = await server.inject({ method: "GET", url: "/health" });
    const boom = await server.inject({ method: "GET", url: "/test-boom" });
    const validation = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      payload: { purchaseAmountCents: -1 },
    });

    expect(health.headers["x-content-type-options"]).toBe("nosniff");
    expect(health.headers["x-frame-options"]).toBe("DENY");
    expect(boom.statusCode).toBe(500);
    expect(boom.body).not.toContain("sensitive stack detail");
    expect(boom.json().error.requestId).toBeTruthy();
    expect(validation.statusCode).toBe(400);
    expect(validation.json().error.message).toBe("Invalid request data");

    await server.close();
  }, 15_000);

  it("returns request ids and captures unexpected errors with redacted context", async () => {
    const captured: unknown[] = [];
    setErrorReporterForTesting({
      captureException: (_error, context) => captured.push(context),
      captureMessage: () => undefined,
    });
    const server = await buildSeededServer();
    server.get("/test-observability-boom", async () => {
      throw new Error("observability boom");
    });

    const ok = await server.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "phase20-request" },
    });
    const boom = await server.inject({
      method: "GET",
      url: "/test-observability-boom",
      headers: { authorization: "Bearer secret-token" },
    });

    expect(ok.headers["x-request-id"]).toBe("phase20-request");
    expect(boom.headers["x-request-id"]).toBeTruthy();
    expect(boom.json().error.requestId).toBe(boom.headers["x-request-id"]);
    expect(captured.length).toBe(1);
    expect(JSON.stringify(captured[0])).toContain("[REDACTED]");

    await server.close();
  });

  it("diagnostics and ops summary are admin-only and omit secrets", async () => {
    const server = await buildSeededServer();

    const denied = await server.inject({
      method: "GET",
      url: "/v1/admin/diagnostics",
      headers: { "x-user-email": "beta@example.com" },
    });
    const diagnostics = await server.inject({
      method: "GET",
      url: "/v1/admin/diagnostics",
      headers: { "x-user-email": "admin@example.com" },
    });
    const ops = await server.inject({
      method: "GET",
      url: "/v1/admin/ops/summary",
      headers: { "x-user-email": "admin@example.com" },
    });

    expect(denied.statusCode).toBe(403);
    expect(diagnostics.statusCode).toBe(200);
    expect(diagnostics.json().database).toBe("ok");
    expect(JSON.stringify(diagnostics.json())).not.toContain(
      "rewards_audit_password",
    );
    expect(ops.statusCode).toBe(200);
    expect(ops.json().recentJobFailures).toEqual(expect.any(Number));
    expect(ops.json().recentEmailFailures).toEqual(expect.any(Number));

    await server.close();
  });

  it("rate limits sensitive routes by user and can be disabled", async () => {
    process.env.RATE_LIMIT_ENABLED = "true";
    process.env.RATE_LIMIT_MAX = "1";
    const server = await buildSeededServer();

    const first = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      headers: { "x-user-email": "beta@example.com" },
      payload: { purchaseAmountCents: -1 },
    });
    const limited = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      headers: { "x-user-email": "beta@example.com" },
      payload: { purchaseAmountCents: -1 },
    });
    const otherUser = await prisma.user.upsert({
      where: { email: "rate-other@example.com" },
      update: {},
      create: { email: "rate-other@example.com" },
    });
    const separateUser = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      headers: { "x-user-email": otherUser.email },
      payload: { purchaseAmountCents: -1 },
    });
    process.env.RATE_LIMIT_ENABLED = "false";
    const disabled = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      headers: { "x-user-email": "beta@example.com" },
      payload: { purchaseAmountCents: -1 },
    });

    expect(first.statusCode).toBe(400);
    expect(limited.statusCode).toBe(429);
    expect(separateUser.statusCode).toBe(400);
    expect(disabled.statusCode).toBe(400);

    await server.close();
  });

  it("consents are idempotent, revocable, and gate Plaid link tokens", async () => {
    const server = await buildSeededServer();
    const consentUser = await prisma.user.upsert({
      where: { email: "consent-gate@example.com" },
      update: { plaidBetaEnabled: true },
      create: { email: "consent-gate@example.com", plaidBetaEnabled: true },
    });
    const headers = { "x-user-email": consentUser.email };

    const denied = await server.inject({
      method: "POST",
      url: "/v1/plaid/link-token",
      headers,
    });
    const firstConsent = await server.inject({
      method: "POST",
      url: "/v1/consents",
      headers,
      payload: { consentType: "PLAID_TRANSACTIONS", version: "test-v1" },
    });
    const duplicateConsent = await server.inject({
      method: "POST",
      url: "/v1/consents",
      headers,
      payload: { consentType: "PLAID_TRANSACTIONS", version: "test-v1" },
    });
    const revoked = await server.inject({
      method: "PATCH",
      url: `/v1/consents/${firstConsent.json().id}/revoke`,
      headers,
    });

    expect(denied.statusCode).toBe(403);
    expect(firstConsent.statusCode).toBe(201);
    expect(duplicateConsent.json().id).toBe(firstConsent.json().id);
    expect(revoked.json().revokedAt).toBeTruthy();

    await server.close();
  });

  it("privacy deletion removes transaction data by source and keeps manual data when deleting Plaid data", async () => {
    const server = await buildSeededServer();
    const user = await prisma.user.upsert({
      where: { email: "privacy-test@example.com" },
      update: { plaidBetaEnabled: false },
      create: { email: "privacy-test@example.com", plaidBetaEnabled: false },
    });
    const headers = { "x-user-email": user.email };
    const [manual, plaid] = await Promise.all([
      prisma.transaction.create({
        data: {
          userId: user.id,
          rawMerchantName: "Manual Coffee",
          amountCents: 1000,
          transactionDate: new Date(),
          source: "MANUAL",
        },
      }),
      prisma.transaction.create({
        data: {
          userId: user.id,
          rawMerchantName: "Plaid Coffee",
          amountCents: 2000,
          transactionDate: new Date(),
          source: "PLAID",
        },
      }),
    ]);
    await prisma.recommendationOutcome.create({
      data: {
        userId: user.id,
        transactionId: plaid.id,
        outcomeType: "UNMATCHED",
        confidence: "LOW",
        explanation: "Test outcome.",
        computedAt: new Date(),
      },
    });

    const wrongConfirmation = await server.inject({
      method: "DELETE",
      url: "/v1/privacy/plaid-data",
      headers,
      payload: { confirmation: "WRONG" },
    });
    const deletePlaid = await server.inject({
      method: "DELETE",
      url: "/v1/privacy/plaid-data",
      headers,
      payload: { confirmation: "DELETE_PLAID_DATA" },
    });
    const manualCount = await prisma.transaction.count({
      where: { id: manual.id },
    });
    const plaidCount = await prisma.transaction.count({
      where: { id: plaid.id },
    });
    const requests = await server.inject({
      method: "GET",
      url: "/v1/privacy/requests",
      headers,
    });

    expect(wrongConfirmation.statusCode).toBe(400);
    expect(deletePlaid.statusCode).toBe(200);
    expect(deletePlaid.json().status).toBe("COMPLETED");
    expect(manualCount).toBe(1);
    expect(plaidCount).toBe(0);
    expect(requests.json()[0].status).toBe("COMPLETED");

    await server.close();
  });

  it("account deletion anonymizes user-owned data while preserving shared cards", async () => {
    const server = await buildSeededServer();
    const user = await prisma.user.upsert({
      where: { email: "delete-account-test@example.com" },
      update: {},
      create: { email: "delete-account-test@example.com" },
    });
    const card = await prisma.card.findUniqueOrThrow({
      where: { slug: "amex-gold" },
    });
    await prisma.userCard.upsert({
      where: { userId_cardId: { userId: user.id, cardId: card.id } },
      update: { isActive: true },
      create: { userId: user.id, cardId: card.id, isActive: true },
    });
    await prisma.transaction.create({
      data: {
        userId: user.id,
        rawMerchantName: "Delete Me",
        amountCents: 1000,
        transactionDate: new Date(),
        source: "MANUAL",
      },
    });

    const response = await server.inject({
      method: "DELETE",
      url: "/v1/privacy/account",
      headers: { "x-user-email": user.email },
      payload: { confirmation: "DELETE_MY_ACCOUNT" },
    });
    const refreshedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const walletCount = await prisma.userCard.count({
      where: { userId: user.id },
    });
    const sharedCard = await prisma.card.findUnique({
      where: { id: card.id },
    });

    expect(response.statusCode).toBe(200);
    expect(refreshedUser.email).toContain("@deleted.local");
    expect(walletCount).toBe(0);
    expect(sharedCard).not.toBeNull();

    await server.close();
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
