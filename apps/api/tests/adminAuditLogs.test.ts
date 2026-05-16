import { describe, expect, it } from "vitest";

import { buildSeededServer } from "./testUtils.js";
import {
  adminHeaders,
  createAdminCard,
  seededMerchant,
} from "./adminPhase8Utils.js";

describe("admin audit logs", () => {
  it("records create/update/expire admin mutation logs and redacts sensitive metadata", async () => {
    const server = await buildSeededServer();
    const card = await createAdminCard(server);
    const merchant = await seededMerchant("starbucks");
    const login = await server.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "admin@example.com",
        password: "AdminPassword12345!",
      },
    });
    const sessionCookie = login.cookies[0]
      ? `${login.cookies[0].name}=${login.cookies[0].value}`
      : "";

    const updatedCard = await server.inject({
      method: "PATCH",
      url: `/v1/admin/cards/${card.id}`,
      headers: adminHeaders,
      payload: { annualFeeCents: 95_00 },
    });
    const offer = await server.inject({
      method: "POST",
      url: "/v1/admin/offers",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        merchantId: merchant.id,
        title: "Audit log offer",
        description: "Offer created during audit log test.",
        offerType: "STATEMENT_CREDIT",
        valueCents: 500,
        activationRequired: true,
        confidence: "HIGH",
        notes: "api_key should be redacted if treated as metadata",
      },
    });
    const expired = await server.inject({
      method: "POST",
      url: `/v1/admin/offers/${offer.json().id}/expire`,
      headers: {
        ...adminHeaders,
        authorization: "Bearer super-secret",
        cookie: sessionCookie,
      },
      payload: { notes: "Retired in test." },
    });
    const nonAdmin = await server.inject({
      method: "GET",
      url: "/v1/admin/audit-logs",
    });
    const cardLogs = await server.inject({
      method: "GET",
      url: `/v1/admin/audit-logs?entityType=Card&entityId=${card.id}`,
      headers: adminHeaders,
    });
    const expireLogs = await server.inject({
      method: "GET",
      url: `/v1/admin/audit-logs?action=EXPIRE&entityId=${offer.json().id}`,
      headers: adminHeaders,
    });

    expect(updatedCard.statusCode).toBe(200);
    expect(offer.statusCode).toBe(201);
    expect(expired.statusCode).toBe(200);
    expect(nonAdmin.statusCode).toBe(403);
    expect(cardLogs.json()[0].before).toBeTruthy();
    expect(cardLogs.json()[0].after.annualFeeCents).toBe(95_00);
    expect(expireLogs.json()[0].action).toBe("EXPIRE");
    expect(JSON.stringify(expireLogs.json())).not.toContain("super-secret");

    await server.close();
  }, 15_000);
});
