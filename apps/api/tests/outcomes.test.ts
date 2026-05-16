import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";
import {
  betaUserCard,
  createRecommendation,
  futureDate,
  uniqueAmountCents,
  uniqueId,
} from "./phase5TestUtils.js";

describe("outcomes API", () => {
  it("GET /v1/outcomes returns current user's outcomes and supports filter", async () => {
    const server = await buildSeededServer();
    const outcome = await createOutcome(server);

    const response = await server.inject({
      method: "GET",
      url: `/v1/outcomes?outcomeType=${outcome.outcomeType}`,
    });
    const ids = response.json().map((item: { id: string }) => item.id);

    expect(response.statusCode).toBe(200);
    expect(ids).toContain(outcome.id);

    await server.close();
  });

  it("GET /v1/outcomes/:id returns detail", async () => {
    const server = await buildSeededServer();
    const outcome = await createOutcome(server);

    const response = await server.inject({
      method: "GET",
      url: `/v1/outcomes/${outcome.id}`,
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.id).toBe(outcome.id);
    expect(body.transaction).toBeDefined();

    await server.close();
  });

  it("user cannot fetch another user's outcome", async () => {
    const server = await buildSeededServer();
    const outcome = await createOtherUserOutcome();

    const response = await server.inject({
      method: "GET",
      url: `/v1/outcomes/${outcome.id}`,
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });
});

async function createOutcome(
  server: Awaited<ReturnType<typeof buildSeededServer>>,
) {
  const amountCents = uniqueAmountCents();
  await createRecommendation(server, amountCents);
  const userCard = await betaUserCard("chase-freedom-unlimited");
  const importResponse = await server.inject({
    method: "POST",
    url: "/v1/transactions/import",
    payload: {
      audit: true,
      transactions: [
        {
          externalId: uniqueId("outcome"),
          rawMerchantName: "Starbucks",
          amountCents,
          transactionDate: futureDate(),
          userCardId: userCard.id,
          observedCategory: "DINING",
        },
      ],
    },
  });

  expect(importResponse.statusCode).toBe(201);
  return importResponse.json().imported[0].outcome as {
    id: string;
    outcomeType: string;
  };
}

async function createOtherUserOutcome() {
  const [user, merchant, card] = await Promise.all([
    prisma.user.upsert({
      where: { email: "phase5-outcome-other@example.com" },
      update: {},
      create: { email: "phase5-outcome-other@example.com" },
    }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
  ]);
  const userCard = await prisma.userCard.upsert({
    where: { userId_cardId: { userId: user.id, cardId: card.id } },
    update: { isActive: true },
    create: { userId: user.id, cardId: card.id, isActive: true },
  });
  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      userCardId: userCard.id,
      merchantId: merchant.id,
      rawMerchantName: "STARBUCKS",
      normalizedMerchantName: "starbucks",
      amountCents: 5000,
      transactionDate: new Date(),
      source: "TEST_FIXTURE",
    },
  });

  return prisma.recommendationOutcome.create({
    data: {
      userId: user.id,
      transactionId: transaction.id,
      outcomeType: "UNMATCHED",
      actualUserCardId: userCard.id,
      capturedValueCents: "100.0",
      missedValueCents: "0.0",
      recommendationWasCorrect: null,
      confidence: "LOW",
      explanation: "Other user fixture.",
      computedAt: new Date(),
    },
  });
}
