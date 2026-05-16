import { expect } from "vitest";

import type { buildSeededServer } from "./testUtils.js";
import { prisma } from "./testUtils.js";

export async function betaUserCard(cardSlug: string) {
  const beta = await prisma.user.findUniqueOrThrow({
    where: { email: "beta@example.com" },
  });
  const card = await prisma.card.findUniqueOrThrow({
    where: { slug: cardSlug },
  });

  return prisma.userCard.findUniqueOrThrow({
    where: { userId_cardId: { userId: beta.id, cardId: card.id } },
  });
}

export async function createRecommendation(
  server: Awaited<ReturnType<typeof buildSeededServer>>,
  amountCents = 5000,
) {
  void server;
  const [beta, merchant, card] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "beta@example.com" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
  ]);
  const userCard = await prisma.userCard.findUniqueOrThrow({
    where: { userId_cardId: { userId: beta.id, cardId: card.id } },
  });
  const event = await prisma.recommendationEvent.create({
    data: {
      userId: beta.id,
      merchantId: merchant.id,
      merchantNameInput: merchant.name,
      purchaseAmountCents: amountCents,
      context: "MANUAL_LOOKUP",
      lens: "PRACTICAL",
      recommendedUserCardId: userCard.id,
      recommendedCardId: card.id,
      expectedCategory: "DINING",
      expectedValueCents: ((amountCents / 100) * 4 * 1.6).toFixed(4),
      confidence: "HIGH",
      explanation: "Phase 5 audit fixture recommendation.",
      inputSnapshot: { originalInput: { merchantName: merchant.name } },
      rankingSnapshot: { rankedCards: [{ userCardId: userCard.id }] },
      ruleSnapshot: {},
    },
  });

  expect(event.id).toBeDefined();
  return { id: event.id };
}

export async function importTransaction(
  server: Awaited<ReturnType<typeof buildSeededServer>>,
  rawMerchantName: string,
  cardSlug = "chase-freedom-unlimited",
  amountCents = 5000,
  transactionDate = futureDate(),
) {
  const userCard = await betaUserCard(cardSlug);
  const response = await server.inject({
    method: "POST",
    url: "/v1/transactions/import",
    payload: {
      transactions: [
        {
          externalId: uniqueId("import"),
          rawMerchantName,
          amountCents,
          transactionDate,
          userCardId: userCard.id,
          observedCategory: "DINING",
        },
      ],
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json().imported[0].transaction as { id: string };
}

export function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function futureDate(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

export function uniqueAmountCents(): number {
  return 12_000 + Math.floor(Math.random() * 1000);
}
