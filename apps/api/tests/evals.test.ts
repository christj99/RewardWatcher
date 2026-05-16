import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";

describe("kill-test eval API", () => {
  it("blocks non-admin users", async () => {
    const server = await buildSeededServer();

    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/evals/kill-test",
    });

    expect(response.statusCode).toBe(403);

    await server.close();
  });

  it("allows admin access with default last-30-days range", async () => {
    const server = await buildSeededServer();
    await createOutcomeFixture({ startDate: daysAgo(3) });

    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/evals/kill-test",
      headers: { "x-user-email": "admin@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().metrics.totalUsersEvaluated).toBeGreaterThan(0);
    expect(response.json().generatedAt).toBeDefined();

    await server.close();
  });

  it("supports explicit ranges and returns metrics plus sorted users", async () => {
    const server = await buildSeededServer();
    const fixture = await createOutcomeFixture();

    const response = await server.inject({
      method: "GET",
      url: killTestUrl(fixture),
      headers: { "x-user-email": "admin@example.com" },
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.metrics.totalUsersEvaluated).toBe(3);
    expect(body.metrics.totalOutcomes).toBe(4);
    expect(body.metrics.totalMatchedRecommendations).toBe(3);
    expect(body.metrics.correctionCount).toBe(1);
    expect(body.metrics.totalMeaningfulMissedValueCents).toBe(9000);
    expect(body.users.map((user: { email: string }) => user.email)).toEqual([
      fixture.highMissEmail,
      fixture.mediumMissEmail,
      fixture.lowMissEmail,
    ]);

    await server.close();
  });

  it("validates bad ranges", async () => {
    const server = await buildSeededServer();
    const reversed = await server.inject({
      method: "GET",
      url: "/v1/admin/evals/kill-test?startDate=2040-02-01T00%3A00%3A00.000Z&endDate=2040-01-01T00%3A00%3A00.000Z",
      headers: { "x-user-email": "admin@example.com" },
    });
    const tooLong = await server.inject({
      method: "GET",
      url: "/v1/admin/evals/kill-test?startDate=2040-01-01T00%3A00%3A00.000Z&endDate=2040-06-01T00%3A00%3A00.000Z",
      headers: { "x-user-email": "admin@example.com" },
    });

    expect(reversed.statusCode).toBe(400);
    expect(tooLong.statusCode).toBe(400);

    await server.close();
  });

  it("query thresholds change meaningful miss and subscription metrics", async () => {
    const server = await buildSeededServer();
    const fixture = await createOutcomeFixture();

    const highThreshold = await server.inject({
      method: "GET",
      url: `${killTestUrl(fixture)}&meaningfulMissThresholdCents=7000`,
      headers: { "x-user-email": "admin@example.com" },
    });
    const lowSubscription = await server.inject({
      method: "GET",
      url: `${killTestUrl(fixture)}&annualSubscriptionPriceCents=1000`,
      headers: { "x-user-email": "admin@example.com" },
    });

    expect(highThreshold.json().metrics.usersWithMeaningfulMiss).toBe(1);
    expect(lowSubscription.json().metrics.usersAboveSubscriptionValue).toBe(2);

    await server.close();
  });

  it("includes only data in range while aggregating all users as admin", async () => {
    const server = await buildSeededServer();
    const fixture = await createOutcomeFixture();
    await createOutOfRangeOutcome(fixture.endDate);

    const response = await server.inject({
      method: "GET",
      url: killTestUrl(fixture),
      headers: { "x-user-email": "admin@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().metrics.totalUsersEvaluated).toBe(3);
    expect(response.json().metrics.totalOutcomes).toBe(4);

    await server.close();
  });
});

type EvalFixture = {
  startDate: string;
  endDate: string;
  highMissEmail: string;
  mediumMissEmail: string;
  lowMissEmail: string;
};

let evalFixtureCounter = 0;

async function createOutcomeFixture(options: { startDate?: Date } = {}) {
  const start = options.startDate ?? newIsolatedRangeStart();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const [card, merchant] = await Promise.all([
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
  ]);
  const highMissEmail = uniqueEmail("eval-api-high");
  const mediumMissEmail = uniqueEmail("eval-api-medium");
  const lowMissEmail = uniqueEmail("eval-api-low");
  const [highMissUser, mediumMissUser, lowMissUser] = await Promise.all([
    createUser(highMissEmail),
    createUser(mediumMissEmail),
    createUser(lowMissEmail),
  ]);

  await createOutcome({
    userId: highMissUser.id,
    userEmail: highMissEmail,
    cardId: card.id,
    merchantId: merchant.id,
    transactionDate: dateAfter(start, 1),
    outcomeType: "USER_MISSED_VALUE",
    missedValueCents: 8000,
    matched: true,
  });
  const mediumRecommendation = await createOutcome({
    userId: mediumMissUser.id,
    userEmail: mediumMissEmail,
    cardId: card.id,
    merchantId: merchant.id,
    transactionDate: dateAfter(start, 2),
    outcomeType: "RECOMMENDATION_ERROR",
    missedValueCents: 1000,
    matched: true,
  });
  await createOutcome({
    userId: mediumMissUser.id,
    userEmail: mediumMissEmail,
    cardId: card.id,
    merchantId: merchant.id,
    transactionDate: dateAfter(start, 3),
    outcomeType: "INCONCLUSIVE",
    missedValueCents: null,
    matched: true,
  });
  await createOutcome({
    userId: lowMissUser.id,
    userEmail: lowMissEmail,
    cardId: card.id,
    merchantId: merchant.id,
    transactionDate: dateAfter(start, 4),
    outcomeType: "CAPTURED_OPTIMAL",
    missedValueCents: 0,
    matched: false,
  });
  await prisma.recommendationCorrection.create({
    data: {
      userId: mediumMissUser.id,
      recommendationEventId: mediumRecommendation.recommendationEventId,
      correctionType: "WRONG_CARD_RULE",
      status: "OPEN",
      userNote: "Eval API fixture correction.",
      createdAt: dateAfter(start, 5),
    },
  });

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    highMissEmail,
    mediumMissEmail,
    lowMissEmail,
  };
}

async function createOutOfRangeOutcome(endDate: string) {
  const [card, merchant, user] = await Promise.all([
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
    createUser(uniqueEmail("eval-api-outside")),
  ]);

  await createOutcome({
    userId: user.id,
    userEmail: user.email,
    cardId: card.id,
    merchantId: merchant.id,
    transactionDate: dateAfter(new Date(endDate), 2),
    outcomeType: "USER_MISSED_VALUE",
    missedValueCents: 9900,
    matched: false,
  });
}

async function createOutcome(input: {
  userId: string;
  userEmail: string;
  cardId: string;
  merchantId: string;
  transactionDate: Date;
  outcomeType:
    | "CAPTURED_OPTIMAL"
    | "USER_MISSED_VALUE"
    | "RECOMMENDATION_ERROR"
    | "INCONCLUSIVE";
  missedValueCents: number | null;
  matched: boolean;
}) {
  const userCard = await prisma.userCard.upsert({
    where: { userId_cardId: { userId: input.userId, cardId: input.cardId } },
    update: { isActive: true },
    create: { userId: input.userId, cardId: input.cardId, isActive: true },
  });
  const recommendation = input.matched
    ? await prisma.recommendationEvent.create({
        data: {
          userId: input.userId,
          merchantId: input.merchantId,
          merchantNameInput: "Starbucks",
          purchaseAmountCents: 5000,
          context: "MANUAL_LOOKUP",
          lens: "PRACTICAL",
          recommendedUserCardId: userCard.id,
          recommendedCardId: input.cardId,
          expectedCategory: "DINING",
          expectedValueCents: "300.0",
          confidence: "HIGH",
          explanation: "Eval API fixture recommendation.",
          inputSnapshot: {},
          rankingSnapshot: {},
          ruleSnapshot: {},
          createdAt: dateAfter(input.transactionDate, -1),
        },
      })
    : null;
  const transaction = await prisma.transaction.create({
    data: {
      userId: input.userId,
      userCardId: input.outcomeType === "INCONCLUSIVE" ? null : userCard.id,
      merchantId: input.merchantId,
      rawMerchantName: "STARBUCKS",
      normalizedMerchantName: "starbucks",
      amountCents: 5000,
      transactionDate: input.transactionDate,
      source: "TEST_FIXTURE",
      observedCategory: input.outcomeType === "INCONCLUSIVE" ? null : "DINING",
      rawData: { fixtureUser: input.userEmail },
    },
  });
  const outcome = await prisma.recommendationOutcome.create({
    data: {
      userId: input.userId,
      recommendationEventId: recommendation?.id,
      transactionId: transaction.id,
      outcomeType: input.outcomeType,
      actualUserCardId:
        input.outcomeType === "INCONCLUSIVE" ? null : userCard.id,
      bestUserCardId: input.outcomeType === "INCONCLUSIVE" ? null : userCard.id,
      recommendedUserCardId: recommendation?.recommendedUserCardId,
      expectedValueCents:
        input.missedValueCents === null
          ? null
          : `${input.missedValueCents + 100}.0`,
      capturedValueCents: input.outcomeType === "INCONCLUSIVE" ? null : "100.0",
      missedValueCents:
        input.missedValueCents === null ? null : `${input.missedValueCents}.0`,
      recommendationWasCorrect:
        input.outcomeType === "RECOMMENDATION_ERROR" ? false : true,
      confidence: input.outcomeType === "INCONCLUSIVE" ? "UNKNOWN" : "HIGH",
      explanation: "Eval API fixture outcome.",
      computedAt: input.transactionDate,
    },
  });

  return { ...outcome, recommendationEventId: recommendation?.id };
}

async function createUser(email: string) {
  return prisma.user.create({
    data: { email },
  });
}

function newIsolatedRangeStart(): Date {
  const start = new Date(Date.UTC(2700, 0, 1));
  const blockOffset =
    ((Math.floor(Date.now() / 1000) % 10_000) + evalFixtureCounter++) * 40;
  start.setUTCDate(start.getUTCDate() + blockOffset);
  return start;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(12, 0, 0, 0);
  return date;
}

function dateAfter(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

function killTestUrl(fixture: Pick<EvalFixture, "startDate" | "endDate">) {
  return `/v1/admin/evals/kill-test?startDate=${encodeURIComponent(
    fixture.startDate,
  )}&endDate=${encodeURIComponent(fixture.endDate)}`;
}
