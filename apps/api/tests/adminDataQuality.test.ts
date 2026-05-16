import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";
import { adminHeaders, betaHeaders } from "./adminPhase8Utils.js";

describe("admin data quality dashboards", () => {
  it("requires admin access for dashboard endpoints", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/dashboard/rule-freshness",
      headers: betaHeaders,
    });

    expect(response.statusCode).toBe(403);
    await server.close();
  });

  it("returns stale, missing-source, and low-confidence rules", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/dashboard/rule-freshness?staleDays=1",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().staleRules.length).toBeGreaterThan(0);
    expect(response.json().lowConfidenceRules.length).toBeGreaterThan(0);
    expect(response.json().missingSourceRules).toBeDefined();
    await server.close();
  });

  it("returns and groups recommendation errors", async () => {
    const server = await buildSeededServer();
    const fixture = await createRecommendationErrorFixture();
    const response = await server.inject({
      method: "GET",
      url: `/v1/admin/dashboard/recommendation-errors?startDate=${encodeURIComponent(fixture.startDate)}&endDate=${encodeURIComponent(fixture.endDate)}`,
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().totalRecommendationErrors).toBeGreaterThan(0);
    expect(response.json().groupedByMerchant[0].count).toBeGreaterThan(0);
    await server.close();
  });

  it("counts open review work", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/dashboard/open-review-work",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().openCorrections).toBeGreaterThanOrEqual(0);
    expect(response.json().openReviewTasks).toBeGreaterThanOrEqual(0);
    expect(response.json().tasksByType).toBeDefined();
    await server.close();
  });
});

let dataQualityFixtureCounter = 0;

async function createRecommendationErrorFixture() {
  const start = new Date(Date.UTC(2300, 0, 1));
  start.setUTCDate(
    start.getUTCDate() + ((Date.now() + dataQualityFixtureCounter++) % 10_000),
  );
  const recommendationDate = addDays(start, -1);
  const transactionDate = addDays(start, 1);
  const end = addDays(start, 7);
  const [beta, merchant, card] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "beta@example.com" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
  ]);
  const userCard = await prisma.userCard.findUniqueOrThrow({
    where: { userId_cardId: { userId: beta.id, cardId: card.id } },
  });
  const recommendation = await prisma.recommendationEvent.create({
    data: {
      userId: beta.id,
      merchantId: merchant.id,
      merchantNameInput: merchant.name,
      purchaseAmountCents: 5000,
      context: "MANUAL_LOOKUP",
      lens: "PRACTICAL",
      recommendedUserCardId: userCard.id,
      recommendedCardId: card.id,
      expectedCategory: "DINING",
      expectedValueCents: "100.0",
      confidence: "HIGH",
      explanation: "Data quality fixture recommendation.",
      inputSnapshot: {},
      rankingSnapshot: {},
      ruleSnapshot: {},
      createdAt: recommendationDate,
    },
  });
  const transaction = await prisma.transaction.create({
    data: {
      userId: beta.id,
      userCardId: userCard.id,
      merchantId: merchant.id,
      rawMerchantName: "STARBUCKS",
      normalizedMerchantName: "starbucks",
      amountCents: 5000,
      transactionDate,
      source: "TEST_FIXTURE",
      observedCategory: "DINING",
    },
  });

  await prisma.recommendationOutcome.create({
    data: {
      userId: beta.id,
      recommendationEventId: recommendation.id,
      transactionId: transaction.id,
      outcomeType: "RECOMMENDATION_ERROR",
      actualUserCardId: userCard.id,
      bestUserCardId: userCard.id,
      recommendedUserCardId: userCard.id,
      expectedValueCents: "200.0",
      capturedValueCents: "100.0",
      missedValueCents: "100.0",
      recommendationWasCorrect: false,
      confidence: "HIGH",
      explanation: "Data quality fixture recommendation error.",
      computedAt: transaction.transactionDate,
    },
  });

  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function addDays(start: Date, days: number): Date {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}
