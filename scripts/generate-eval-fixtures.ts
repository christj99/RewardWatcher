import {
  EVAL_FIXTURE_USERS,
  type KillTestOutcomeType,
} from "../packages/rewards-engine/src/index.js";
import { prisma, seedDatabase } from "../packages/db/src/index.js";

type FixtureUserKey =
  | "eval-pass-1@example.com"
  | "eval-pass-2@example.com"
  | "eval-pass-3@example.com"
  | "eval-low-value@example.com"
  | "eval-error-heavy@example.com"
  | "eval-inconclusive@example.com";

const fixtureStart = daysAgo(25);

async function main(): Promise<void> {
  await seedDatabase();
  await deleteExistingFixtureData();

  const base = await loadBaseRecords();
  const users = await createFixtureUsers(base.cards);

  await createScenario(users["eval-pass-1@example.com"], base, [
    matchedOutcome("USER_MISSED_VALUE", 1800, "starbucks", "DINING", {
      actualCard: "chaseFreedomUnlimited",
      bestCard: "amexGold",
      recommendedCard: "amexGold",
    }),
    matchedOutcome("CAPTURED_OPTIMAL", 0, "wholeFoods", "GROCERY", {
      actualCard: "amexGold",
      bestCard: "amexGold",
      recommendedCard: "amexGold",
    }),
  ]);

  await createScenario(users["eval-pass-2@example.com"], base, [
    matchedOutcome("USER_MISSED_VALUE", 2200, "uberEats", "DINING", {
      actualCard: "chaseFreedomUnlimited",
      bestCard: "amexGold",
      recommendedCard: "amexGold",
    }),
    unmatchedOutcome("UNMATCHED", 900, "airbnb", "TRAVEL", {
      actualCard: "chaseFreedomUnlimited",
      bestCard: "capitalOneVentureX",
    }),
  ]);

  await createScenario(users["eval-pass-3@example.com"], base, [
    matchedOutcome("USER_MISSED_VALUE", 7600, "delta", "AIRFARE", {
      actualCard: "chaseFreedomUnlimited",
      bestCard: "amexGold",
      recommendedCard: "amexGold",
    }),
  ]);

  await createScenario(users["eval-low-value@example.com"], base, [
    matchedOutcome("CAPTURED_OPTIMAL", 0, "wholeFoods", "GROCERY", {
      actualCard: "amexGold",
      bestCard: "amexGold",
      recommendedCard: "amexGold",
    }),
    matchedOutcome("USER_MISSED_VALUE", 125, "target", "GENERAL", {
      actualCard: "capitalOneVentureX",
      bestCard: "capitalOneVentureX",
      recommendedCard: "capitalOneVentureX",
    }),
  ]);

  const errorRecommendation = await createScenario(
    users["eval-error-heavy@example.com"],
    base,
    [
      matchedOutcome("RECOMMENDATION_ERROR", 1400, "walmart", "GENERAL", {
        actualCard: "chaseFreedomUnlimited",
        bestCard: "capitalOneVentureX",
        recommendedCard: "amexGold",
      }),
      matchedOutcome("USER_OVERRIDE", 700, "amazon", "ONLINE_RETAIL", {
        actualCard: "chaseFreedomUnlimited",
        bestCard: "capitalOneVentureX",
        recommendedCard: "capitalOneVentureX",
      }),
    ],
  );

  await prisma.recommendationCorrection.create({
    data: {
      userId: users["eval-error-heavy@example.com"].id,
      recommendationEventId: errorRecommendation[0]?.id,
      correctionType: "WRONG_CARD_RULE",
      userNote: "Eval fixture correction for a recommendation error.",
      status: "OPEN",
    },
  });

  await createScenario(users["eval-inconclusive@example.com"], base, [
    inconclusiveOutcome("localRestaurant"),
    inconclusiveOutcome("starbucks"),
  ]);

  console.log(
    `Generated eval fixtures for ${EVAL_FIXTURE_USERS.length} users.`,
  );
}

async function deleteExistingFixtureData(): Promise<void> {
  const fixtureUsers = await prisma.user.findMany({
    where: { email: { in: EVAL_FIXTURE_USERS.map((user) => user.email) } },
    select: { id: true },
  });
  const userIds = fixtureUsers.map((user) => user.id);

  if (userIds.length === 0) {
    return;
  }

  await prisma.curatorReviewTask.deleteMany({
    where: { correction: { userId: { in: userIds } } },
  });
  await prisma.recommendationCorrection.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.recommendationOutcome.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.transaction.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.recommendationEvent.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.capLedger.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.userPreferenceRule.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.userCard.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
}

async function loadBaseRecords() {
  const [
    amexGold,
    chaseFreedomUnlimited,
    capitalOneVentureX,
    starbucks,
    wholeFoods,
    uberEats,
    airbnb,
    delta,
    target,
    walmart,
    amazon,
    localRestaurant,
  ] = await Promise.all([
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
    prisma.card.findUniqueOrThrow({
      where: { slug: "chase-freedom-unlimited" },
    }),
    prisma.card.findUniqueOrThrow({ where: { slug: "capital-one-venture-x" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "whole-foods" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "uber-eats" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "airbnb" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "delta-air-lines" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "target" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "walmart" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "amazon" } }),
    prisma.merchant.findUniqueOrThrow({
      where: { slug: "local-restaurant-test-merchant" },
    }),
  ]);

  return {
    cards: { amexGold, chaseFreedomUnlimited, capitalOneVentureX },
    merchants: {
      starbucks,
      wholeFoods,
      uberEats,
      airbnb,
      delta,
      target,
      walmart,
      amazon,
      localRestaurant,
    },
  };
}

async function createFixtureUsers(
  cards: Awaited<ReturnType<typeof loadBaseRecords>>["cards"],
) {
  const users = {} as Record<FixtureUserKey, { id: string }>;

  for (const scenario of EVAL_FIXTURE_USERS) {
    const user = await prisma.user.create({
      data: {
        email: scenario.email,
        displayName: scenario.displayName,
      },
    });

    await Promise.all(
      Object.values(cards).map((card) =>
        prisma.userCard.create({
          data: {
            userId: user.id,
            cardId: card.id,
            isActive: true,
          },
        }),
      ),
    );

    users[scenario.email as FixtureUserKey] = user;
  }

  return users;
}

type ScenarioOutcome = {
  outcomeType: KillTestOutcomeType;
  missedValueCents: number | null;
  merchantKey: keyof Awaited<ReturnType<typeof loadBaseRecords>>["merchants"];
  observedCategory: string | null;
  actualCard?: keyof Awaited<ReturnType<typeof loadBaseRecords>>["cards"];
  bestCard?: keyof Awaited<ReturnType<typeof loadBaseRecords>>["cards"];
  recommendedCard?: keyof Awaited<ReturnType<typeof loadBaseRecords>>["cards"];
  matched: boolean;
};

function matchedOutcome(
  outcomeType: KillTestOutcomeType,
  missedValueCents: number,
  merchantKey: ScenarioOutcome["merchantKey"],
  observedCategory: string,
  cards: Pick<ScenarioOutcome, "actualCard" | "bestCard" | "recommendedCard">,
): ScenarioOutcome {
  return {
    outcomeType,
    missedValueCents,
    merchantKey,
    observedCategory,
    matched: true,
    ...cards,
  };
}

function unmatchedOutcome(
  outcomeType: KillTestOutcomeType,
  missedValueCents: number,
  merchantKey: ScenarioOutcome["merchantKey"],
  observedCategory: string,
  cards: Pick<ScenarioOutcome, "actualCard" | "bestCard">,
): ScenarioOutcome {
  return {
    outcomeType,
    missedValueCents,
    merchantKey,
    observedCategory,
    matched: false,
    ...cards,
  };
}

function inconclusiveOutcome(
  merchantKey: ScenarioOutcome["merchantKey"],
): ScenarioOutcome {
  return {
    outcomeType: "INCONCLUSIVE",
    missedValueCents: null,
    merchantKey,
    observedCategory: null,
    matched: false,
  };
}

async function createScenario(
  user: { id: string },
  base: Awaited<ReturnType<typeof loadBaseRecords>>,
  outcomes: ScenarioOutcome[],
) {
  const userCards = await prisma.userCard.findMany({
    where: { userId: user.id },
    include: { card: true },
  });
  const userCardBySlug = new Map(
    userCards.map((userCard) => [userCard.card.slug, userCard]),
  );
  const recommendations = [];

  for (const [index, outcome] of outcomes.entries()) {
    const merchant = base.merchants[outcome.merchantKey];
    const date = daysAfter(fixtureStart, index + 1);
    const recommendedCard = outcome.recommendedCard
      ? base.cards[outcome.recommendedCard]
      : null;
    const recommendedUserCard = recommendedCard
      ? userCardBySlug.get(recommendedCard.slug)
      : null;
    const recommendation =
      outcome.matched && recommendedCard
        ? await prisma.recommendationEvent.create({
            data: {
              userId: user.id,
              merchantId: merchant.id,
              merchantNameInput: merchant.name,
              purchaseAmountCents: 10_000,
              context: "MANUAL_LOOKUP",
              lens: "PRACTICAL",
              recommendedUserCardId: recommendedUserCard?.id,
              recommendedCardId: recommendedCard.id,
              expectedCategory: merchant.category,
              expectedValueCents: "500.0",
              confidence: "HIGH",
              explanation: "Eval fixture recommendation.",
              inputSnapshot: {},
              rankingSnapshot: {},
              ruleSnapshot: {},
              createdAt: daysAfter(date, -1),
            },
          })
        : null;
    const actualUserCard = outcome.actualCard
      ? userCardBySlug.get(base.cards[outcome.actualCard].slug)
      : null;
    const bestUserCard = outcome.bestCard
      ? userCardBySlug.get(base.cards[outcome.bestCard].slug)
      : null;
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        userCardId: actualUserCard?.id,
        merchantId: merchant.id,
        rawMerchantName: merchant.name.toUpperCase(),
        normalizedMerchantName: merchant.name.toLowerCase(),
        amountCents: 10_000,
        transactionDate: date,
        source: "TEST_FIXTURE",
        externalId: `eval-${user.id}-${index}`,
        observedCategory: outcome.observedCategory,
        rawData: { fixture: "phase-7-eval" },
      },
    });

    await prisma.recommendationOutcome.create({
      data: {
        userId: user.id,
        recommendationEventId: recommendation?.id,
        transactionId: transaction.id,
        outcomeType: outcome.outcomeType,
        actualUserCardId: actualUserCard?.id,
        bestUserCardId: bestUserCard?.id,
        recommendedUserCardId: recommendedUserCard?.id,
        expectedValueCents: outcome.missedValueCents
          ? `${outcome.missedValueCents + 500}.0`
          : null,
        capturedValueCents:
          outcome.outcomeType === "INCONCLUSIVE" ? null : "500.0",
        missedValueCents:
          outcome.missedValueCents === null
            ? null
            : `${outcome.missedValueCents}.0`,
        recommendationWasCorrect:
          outcome.outcomeType === "RECOMMENDATION_ERROR" ? false : true,
        confidence: outcome.outcomeType === "INCONCLUSIVE" ? "UNKNOWN" : "HIGH",
        explanation: "Eval fixture outcome.",
        computedAt: date,
      },
    });

    if (recommendation) {
      recommendations.push(recommendation);
    }
  }

  return recommendations;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(12, 0, 0, 0);
  return date;
}

function daysAfter(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
