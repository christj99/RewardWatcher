import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";
import {
  betaUserCard,
  createRecommendation,
  futureDate,
  uniqueAmountCents,
  uniqueId,
} from "./phase5TestUtils.js";

describe("transaction audit API", () => {
  it("import with audit=true creates RecommendationOutcome", async () => {
    const server = await buildSeededServer();
    const amountCents = uniqueAmountCents();
    await createRecommendation(server, amountCents);
    const userCard = await betaUserCard("chase-freedom-unlimited");

    const response = await server.inject({
      method: "POST",
      url: "/v1/transactions/import",
      payload: {
        audit: true,
        transactions: [
          {
            externalId: uniqueId("audit-import"),
            rawMerchantName: "Starbucks",
            amountCents,
            transactionDate: futureDate(),
            userCardId: userCard.id,
            observedCategory: "DINING",
          },
        ],
      },
    });
    const item = response.json().imported[0];

    expect(response.statusCode).toBe(201);
    expect(response.json().auditedCount).toBe(1);
    expect(item.outcome.id).toBeDefined();
  });

  it("POST /v1/transactions/:id/audit creates and reuses outcome", async () => {
    const server = await buildSeededServer();
    const amountCents = uniqueAmountCents();
    await createRecommendation(server, amountCents);
    const transaction = await importAuditableTransaction(
      server,
      "chase-freedom-unlimited",
      amountCents,
    );

    const first = await server.inject({
      method: "POST",
      url: `/v1/transactions/${transaction.id}/audit`,
    });
    const second = await server.inject({
      method: "POST",
      url: `/v1/transactions/${transaction.id}/audit`,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);

    await server.close();
  });

  it("audit links to prior RecommendationEvent and can produce USER_MISSED_VALUE", async () => {
    const server = await buildSeededServer();
    const amountCents = uniqueAmountCents();
    const recommendation = await createRecommendation(server, amountCents);
    const transaction = await importAuditableTransaction(
      server,
      "chase-freedom-unlimited",
      amountCents,
    );

    const response = await server.inject({
      method: "POST",
      url: `/v1/transactions/${transaction.id}/audit`,
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.recommendationEventId).toBe(recommendation.id);
    expect(body.outcomeType).toBe("USER_MISSED_VALUE");

    await server.close();
  });

  it("audit can produce CAPTURED_OPTIMAL", async () => {
    const server = await buildSeededServer();
    const amountCents = uniqueAmountCents();
    await createRecommendation(server, amountCents);
    const transaction = await importAuditableTransaction(
      server,
      "amex-gold",
      amountCents,
    );

    const response = await server.inject({
      method: "POST",
      url: `/v1/transactions/${transaction.id}/audit`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().outcomeType).toBe("CAPTURED_OPTIMAL");

    await server.close();
  });

  it("audit can produce UNMATCHED when no prior recommendation exists", async () => {
    const server = await buildSeededServer();
    const userCard = await betaUserCard("chase-freedom-unlimited");
    const merchant = await prisma.merchant.findUniqueOrThrow({
      where: { slug: "target" },
    });
    const transaction = await prisma.transaction.create({
      data: {
        userId: userCard.userId,
        userCardId: userCard.id,
        merchantId: merchant.id,
        rawMerchantName: "TARGET T-1234",
        normalizedMerchantName: "target t",
        amountCents: 12345,
        transactionDate: new Date(Date.now() + 60_000),
        source: "TEST_FIXTURE",
        observedCategory: "GENERAL",
      },
    });

    const response = await server.inject({
      method: "POST",
      url: `/v1/transactions/${transaction.id}/audit`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().outcomeType).toBe("UNMATCHED");

    await server.close();
  });

  it("audit returns INCONCLUSIVE when missing actual card", async () => {
    const server = await buildSeededServer();
    const merchant = await prisma.merchant.findUniqueOrThrow({
      where: { slug: "starbucks" },
    });
    const beta = await prisma.user.findUniqueOrThrow({
      where: { email: "beta@example.com" },
    });
    const transaction = await prisma.transaction.create({
      data: {
        userId: beta.id,
        merchantId: merchant.id,
        rawMerchantName: "STARBUCKS",
        normalizedMerchantName: "starbucks",
        amountCents: 5000,
        transactionDate: new Date(Date.now() + 60_000),
        source: "TEST_FIXTURE",
        observedCategory: "DINING",
      },
    });

    const response = await server.inject({
      method: "POST",
      url: `/v1/transactions/${transaction.id}/audit`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().outcomeType).toBe("INCONCLUSIVE");

    await server.close();
  });
});

async function importAuditableTransaction(
  server: Awaited<ReturnType<typeof buildSeededServer>>,
  cardSlug: string,
  amountCents = 5000,
) {
  const userCard = await betaUserCard(cardSlug);
  const response = await server.inject({
    method: "POST",
    url: "/v1/transactions/import",
    payload: {
      transactions: [
        {
          externalId: uniqueId(`audit-${cardSlug}`),
          rawMerchantName: "Starbucks",
          amountCents,
          transactionDate: futureDate(),
          userCardId: userCard.id,
          observedCategory: "DINING",
        },
      ],
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json().imported[0].transaction as { id: string };
}
