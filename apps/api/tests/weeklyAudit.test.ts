import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";

describe("weekly audit report API", () => {
  it("GET /v1/audit/weekly returns report for current user with explicit range", async () => {
    const server = await buildSeededServer();
    const fixture = await createWeeklyFixture();

    const response = await server.inject({
      method: "GET",
      url: weeklyUrl(fixture),
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.totalOutcomes).toBe(5);
    expect(body.totalTransactionsAudited).toBe(5);
    expect(body.totalRecommendationsMatched).toBe(3);
    expect(body.estimatedValueCapturedCents).toBe(500);
    expect(body.estimatedValueMissedCents).toBe(1000);

    await server.close();
  });

  it("default date range works", async () => {
    const server = await buildSeededServer();

    const response = await server.inject({
      method: "GET",
      url: "/v1/audit/weekly",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().weekStart).toBeDefined();
    expect(response.json().weekEnd).toBeDefined();

    await server.close();
  });

  it("invalid date ranges return 400", async () => {
    const server = await buildSeededServer();
    const reversed = await server.inject({
      method: "GET",
      url: weeklyUrl({
        weekStart: "2040-01-08T00:00:00.000Z",
        weekEnd: "2040-01-01T00:00:00.000Z",
      }),
    });
    const tooLong = await server.inject({
      method: "GET",
      url: weeklyUrl({
        weekStart: "2040-01-01T00:00:00.000Z",
        weekEnd: "2040-03-01T00:00:00.000Z",
      }),
    });

    expect(reversed.statusCode).toBe(400);
    expect(tooLong.statusCode).toBe(400);

    await server.close();
  });

  it("minMissedValueCents changes meaningful miss count", async () => {
    const server = await buildSeededServer();
    const fixture = await createWeeklyFixture();

    const response = await server.inject({
      method: "GET",
      url: `${weeklyUrl(fixture)}&minMissedValueCents=600`,
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.meaningfulMissCount).toBe(0);
    expect(body.meaningfulMissedValueCents).toBe(0);

    await server.close();
  });

  it("includeInconclusive and includeUnmatched flags affect items only", async () => {
    const server = await buildSeededServer();
    const fixture = await createWeeklyFixture();

    const inconclusive = await server.inject({
      method: "GET",
      url: `${weeklyUrl(fixture)}&includeInconclusive=true`,
    });
    const noUnmatched = await server.inject({
      method: "GET",
      url: `${weeklyUrl(fixture)}&includeUnmatched=false`,
    });

    expect(
      inconclusive
        .json()
        .items.some(
          (item: { outcomeType: string }) =>
            item.outcomeType === "INCONCLUSIVE",
        ),
    ).toBe(true);
    expect(noUnmatched.json().unmatchedCount).toBe(1);
    expect(
      noUnmatched
        .json()
        .items.some(
          (item: { outcomeType: string }) => item.outcomeType === "UNMATCHED",
        ),
    ).toBe(false);

    await server.close();
  });

  it("report only includes current user's outcomes and top miss/action are deterministic", async () => {
    const server = await buildSeededServer();
    const fixture = await createWeeklyFixture({ includeOtherUser: true });

    const response = await server.inject({
      method: "GET",
      url: weeklyUrl(fixture),
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.totalOutcomes).toBe(5);
    expect(body.topMiss.outcomeId).toBe(fixture.userMissOutcomeId);
    expect(body.recommendedAction).toBe(body.topMiss.actionText);

    await server.close();
  });

  it("report includes card summaries and handles null merchant/card fields", async () => {
    const server = await buildSeededServer();
    const fixture = await createWeeklyFixture();

    const response = await server.inject({
      method: "GET",
      url: `${weeklyUrl(fixture)}&includeInconclusive=true`,
    });
    const body = response.json();
    const missed = body.items.find(
      (item: { outcomeId: string }) =>
        item.outcomeId === fixture.userMissOutcomeId,
    );
    const inconclusive = body.items.find(
      (item: { outcomeType: string }) => item.outcomeType === "INCONCLUSIVE",
    );

    expect(missed.actualCard.name).toBe("Chase Freedom Unlimited");
    expect(missed.bestCard.name).toBe("American Express Gold Card");
    expect(inconclusive.merchantName).toBe("UNKNOWN MERCHANT");

    await server.close();
  });

  it("includes wallet action enrichment from reminders and credit usage", async () => {
    const server = await buildSeededServer();
    const fixture = await createWeeklyFixture();
    const beta = await prisma.user.findUniqueOrThrow({
      where: { email: "beta@example.com" },
    });
    const card = await prisma.card.findUniqueOrThrow({
      where: { slug: "amex-gold" },
    });
    const userCard = await prisma.userCard.findUniqueOrThrow({
      where: { userId_cardId: { userId: beta.id, cardId: card.id } },
    });
    const credit = await prisma.statementCredit.create({
      data: {
        cardId: card.id,
        name: `Weekly action credit ${Math.random()}`,
        description: "Weekly audit action fixture.",
        amountCents: 1000,
        recurrence: "MONTHLY",
        confidence: "HIGH",
      },
    });
    await prisma.reminder.create({
      data: {
        userId: beta.id,
        userCardId: userCard.id,
        reminderType: "WELCOME_BONUS_DEADLINE",
        title: "Check welcome bonus deadline",
        dueAt: new Date("2000-01-01T00:00:00.000Z"),
        source: "WELCOME_BONUS",
      },
    });
    await prisma.statementCreditUsage.create({
      data: {
        userId: beta.id,
        userCardId: userCard.id,
        statementCreditId: credit.id,
        periodStart: new Date(fixture.weekStart),
        periodEnd: new Date(fixture.weekEnd),
        status: "UNUSED",
        estimatedRemainingCents: credit.amountCents,
        source: "GENERATED",
      },
    });

    const response = await server.inject({
      method: "GET",
      url: weeklyUrl(fixture),
    });
    const walletActions = response.json().walletActions;

    expect(response.statusCode).toBe(200);
    expect(walletActions.overdueReminderCount).toBeGreaterThan(0);
    expect(walletActions.unusedStatementCreditCount).toBeGreaterThan(0);
    expect(walletActions.topAction.title).toBe("Check welcome bonus deadline");

    await server.close();
  });
});

type WeeklyFixture = {
  weekStart: string;
  weekEnd: string;
  userMissOutcomeId?: string;
};

let weeklyFixtureCounter = 0;

async function createWeeklyFixture(
  options: { includeOtherUser?: boolean } = {},
): Promise<Required<WeeklyFixture>> {
  const start = new Date(Date.UTC(4000, 0, 1));
  start.setUTCDate(
    start.getUTCDate() +
      weeklyFixtureCounter++ * 17 +
      Math.floor(Math.random() * 1_000_000),
  );
  const weekStart = start.toISOString();
  const weekEndDate = new Date(start);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 7);
  const weekEnd = weekEndDate.toISOString();
  const [beta, merchant, amexGold, freedomUnlimited] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "beta@example.com" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
    prisma.card.findUniqueOrThrow({
      where: { slug: "chase-freedom-unlimited" },
    }),
  ]);
  const [goldUserCard, freedomUserCard] = await Promise.all([
    prisma.userCard.findUniqueOrThrow({
      where: { userId_cardId: { userId: beta.id, cardId: amexGold.id } },
    }),
    prisma.userCard.findUniqueOrThrow({
      where: {
        userId_cardId: { userId: beta.id, cardId: freedomUnlimited.id },
      },
    }),
  ]);
  const recommendation = await prisma.recommendationEvent.create({
    data: {
      userId: beta.id,
      merchantId: merchant.id,
      merchantNameInput: merchant.name,
      purchaseAmountCents: 5000,
      context: "MANUAL_LOOKUP",
      lens: "PRACTICAL",
      recommendedUserCardId: goldUserCard.id,
      recommendedCardId: amexGold.id,
      expectedCategory: "DINING",
      expectedValueCents: "320.0",
      confidence: "HIGH",
      explanation: "Weekly report fixture.",
      inputSnapshot: {},
      rankingSnapshot: {},
      ruleSnapshot: {},
    },
  });

  await createOutcome({
    userId: beta.id,
    merchantId: merchant.id,
    userCardId: goldUserCard.id,
    outcomeType: "CAPTURED_OPTIMAL",
    actualUserCardId: goldUserCard.id,
    bestUserCardId: goldUserCard.id,
    recommendedUserCardId: goldUserCard.id,
    recommendationEventId: recommendation.id,
    transactionDate: day(start, 1),
    capturedValueCents: "300.0",
    missedValueCents: "0.0",
  });
  const userMiss = await createOutcome({
    userId: beta.id,
    merchantId: merchant.id,
    userCardId: freedomUserCard.id,
    outcomeType: "USER_MISSED_VALUE",
    actualUserCardId: freedomUserCard.id,
    bestUserCardId: goldUserCard.id,
    recommendedUserCardId: goldUserCard.id,
    recommendationEventId: recommendation.id,
    transactionDate: day(start, 2),
    capturedValueCents: "100.0",
    missedValueCents: "500.0",
  });
  await createOutcome({
    userId: beta.id,
    merchantId: merchant.id,
    userCardId: freedomUserCard.id,
    outcomeType: "RECOMMENDATION_ERROR",
    actualUserCardId: freedomUserCard.id,
    bestUserCardId: goldUserCard.id,
    recommendedUserCardId: freedomUserCard.id,
    recommendationEventId: recommendation.id,
    transactionDate: day(start, 3),
    capturedValueCents: "100.0",
    missedValueCents: "300.0",
  });
  await createOutcome({
    userId: beta.id,
    merchantId: merchant.id,
    userCardId: freedomUserCard.id,
    outcomeType: "UNMATCHED",
    actualUserCardId: freedomUserCard.id,
    bestUserCardId: goldUserCard.id,
    transactionDate: day(start, 4),
    capturedValueCents: "0.0",
    missedValueCents: "200.0",
  });
  await createOutcome({
    userId: beta.id,
    merchantId: null,
    userCardId: null,
    outcomeType: "INCONCLUSIVE",
    transactionDate: day(start, 5),
    capturedValueCents: null,
    missedValueCents: null,
    confidence: "UNKNOWN",
  });

  if (options.includeOtherUser) {
    await createOtherUserOutcome(merchant.id, amexGold.id, start);
  }

  return { weekStart, weekEnd, userMissOutcomeId: userMiss.id };
}

async function createOutcome(input: {
  userId: string;
  merchantId: string | null;
  userCardId: string | null;
  outcomeType:
    | "CAPTURED_OPTIMAL"
    | "USER_MISSED_VALUE"
    | "RECOMMENDATION_ERROR"
    | "UNMATCHED"
    | "INCONCLUSIVE";
  transactionDate: Date;
  actualUserCardId?: string;
  bestUserCardId?: string;
  recommendedUserCardId?: string;
  recommendationEventId?: string;
  capturedValueCents: string | null;
  missedValueCents: string | null;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
}) {
  const transaction = await prisma.transaction.create({
    data: {
      userId: input.userId,
      userCardId: input.userCardId,
      merchantId: input.merchantId,
      rawMerchantName: input.merchantId ? "STARBUCKS" : "UNKNOWN MERCHANT",
      normalizedMerchantName: input.merchantId ? "starbucks" : null,
      amountCents: 5000,
      transactionDate: input.transactionDate,
      source: "TEST_FIXTURE",
    },
  });

  return prisma.recommendationOutcome.create({
    data: {
      userId: input.userId,
      recommendationEventId: input.recommendationEventId,
      transactionId: transaction.id,
      outcomeType: input.outcomeType,
      actualUserCardId: input.actualUserCardId,
      bestUserCardId: input.bestUserCardId,
      recommendedUserCardId: input.recommendedUserCardId,
      expectedValueCents: input.capturedValueCents,
      capturedValueCents: input.capturedValueCents,
      missedValueCents: input.missedValueCents,
      recommendationWasCorrect: input.outcomeType !== "RECOMMENDATION_ERROR",
      confidence: input.confidence ?? "HIGH",
      explanation: "Weekly audit fixture outcome.",
      computedAt: input.transactionDate,
    },
  });
}

async function createOtherUserOutcome(
  merchantId: string,
  cardId: string,
  start: Date,
) {
  const email = `weekly-other-${Math.random()}@example.com`;
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
  const userCard = await prisma.userCard.upsert({
    where: { userId_cardId: { userId: user.id, cardId } },
    update: { isActive: true },
    create: { userId: user.id, cardId, isActive: true },
  });

  await createOutcome({
    userId: user.id,
    merchantId,
    userCardId: userCard.id,
    outcomeType: "USER_MISSED_VALUE",
    actualUserCardId: userCard.id,
    bestUserCardId: userCard.id,
    transactionDate: day(start, 2),
    capturedValueCents: "0.0",
    missedValueCents: "999.0",
  });
}

function day(start: Date, offset: number): Date {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

function weeklyUrl(fixture: Pick<WeeklyFixture, "weekStart" | "weekEnd">) {
  return `/v1/audit/weekly?weekStart=${encodeURIComponent(
    fixture.weekStart,
  )}&weekEnd=${encodeURIComponent(fixture.weekEnd)}`;
}
