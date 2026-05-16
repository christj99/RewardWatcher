import { describe, expect, it } from "vitest";

import { calculateKillTestReport } from "../killTestMetrics.js";
import type { KillTestOutcomeDto } from "../killTestTypes.js";

const startDate = "2026-01-01T00:00:00.000Z";
const endDate = "2026-02-01T00:00:00.000Z";

describe("kill-test metrics", () => {
  it("returns zero metrics and fails primary kill test for empty input", () => {
    const { metrics, users } = report([]);

    expect(users).toEqual([]);
    expect(metrics.totalUsersEvaluated).toBe(0);
    expect(metrics.totalOutcomes).toBe(0);
    expect(metrics.passFail.passesPrimaryKillTest).toBe(false);
    expect(metrics.passFail.overallPass).toBe(false);
  });

  it("applies meaningful miss thresholds and ignores tiny misses", () => {
    const { metrics, users } = report([
      outcome("a", "u1", "USER_MISSED_VALUE", 499),
      outcome("b", "u2", "USER_MISSED_VALUE", 500),
    ]);

    expect(metrics.totalMissedValueCents).toBe(999);
    expect(metrics.totalMeaningfulMissedValueCents).toBe(500);
    expect(metrics.usersWithMeaningfulMiss).toBe(1);
    expect(users.find((user) => user.userId === "u1")?.hasMeaningfulMiss).toBe(
      false,
    );
  });

  it("counts users above subscription value", () => {
    const { metrics } = report([
      outcome("a", "u1", "USER_MISSED_VALUE", 6900),
      outcome("b", "u2", "USER_MISSED_VALUE", 600),
    ]);

    expect(metrics.usersAboveSubscriptionValue).toBe(1);
    expect(metrics.percentUsersAboveSubscriptionValue).toBe(50);
  });

  it("computes averages and odd-user median missed values", () => {
    const { metrics } = report([
      outcome("a", "u1", "USER_MISSED_VALUE", 100),
      outcome("b", "u2", "USER_MISSED_VALUE", 300),
      outcome("c", "u3", "USER_MISSED_VALUE", 500),
    ]);

    expect(metrics.averageMissedValuePerUserCents).toBe(300);
    expect(metrics.medianMissedValuePerUserCents).toBe(300);
  });

  it("computes even-user median missed values", () => {
    const { metrics } = report([
      outcome("a", "u1", "USER_MISSED_VALUE", 100),
      outcome("b", "u2", "USER_MISSED_VALUE", 500),
    ]);

    expect(metrics.medianMissedValuePerUserCents).toBe(300);
  });

  it("uses matched recommendations as recommendation error denominator", () => {
    const { metrics } = report([
      outcome("a", "u1", "RECOMMENDATION_ERROR", 800, {
        recommendationEventId: "r1",
      }),
      outcome("b", "u1", "USER_MISSED_VALUE", 800, {
        recommendationEventId: "r2",
      }),
      outcome("c", "u1", "UNMATCHED", 800),
    ]);
    const noMatched = report([
      outcome("d", "u1", "RECOMMENDATION_ERROR", 800),
    ]).metrics;

    expect(metrics.recommendationErrorRate).toBe(0.5);
    expect(noMatched.recommendationErrorRate).toBe(0);
  });

  it("computes inconclusive, unmatched, and correction rates", () => {
    const { metrics } = report(
      [
        outcome("a", "u1", "INCONCLUSIVE", null),
        outcome("b", "u1", "UNMATCHED", 600),
        outcome("c", "u2", "CAPTURED_OPTIMAL", 0),
      ],
      { corrections: [{ id: "c1", userId: "u1", createdAt: startDate }] },
    );

    expect(metrics.inconclusiveRate).toBe(1 / 3);
    expect(metrics.unmatchedOutcomeRate).toBe(1 / 3);
    expect(metrics.correctionsPer100Outcomes).toBeCloseTo(33.333, 2);
  });

  it("sorts top miss categories and merchants deterministically", () => {
    const { metrics } = report([
      outcome("a", "u1", "USER_MISSED_VALUE", 600, {
        category: "DINING",
        merchantName: "Starbucks",
      }),
      outcome("b", "u2", "UNMATCHED", 900, {
        category: "DINING",
        merchantName: "Starbucks",
      }),
      outcome("c", "u3", "RECOMMENDATION_ERROR", 900, {
        category: "GROCERY",
        merchantName: "Whole Foods",
      }),
    ]);

    expect(metrics.topMissCategories[0]).toEqual({
      category: "DINING",
      count: 2,
      missedValueCents: 1500,
    });
    expect(metrics.topMissMerchants[0]?.merchantName).toBe("Starbucks");
  });

  it("sorts top recommendation error merchants by count then name", () => {
    const { metrics } = report([
      outcome("a", "u1", "RECOMMENDATION_ERROR", 600, {
        merchantName: "Target",
        recommendationEventId: "r1",
      }),
      outcome("b", "u2", "RECOMMENDATION_ERROR", 700, {
        merchantName: "Amazon",
        recommendationEventId: "r2",
      }),
      outcome("c", "u3", "RECOMMENDATION_ERROR", 800, {
        merchantName: "Amazon",
        recommendationEventId: "r3",
      }),
    ]);

    expect(metrics.topRecommendationErrorMerchants).toEqual([
      { merchantName: "Amazon", count: 2 },
      { merchantName: "Target", count: 1 },
    ]);
  });

  it("passes primary kill test when at least half of users have meaningful misses", () => {
    const { metrics } = report([
      outcome("a", "u1", "USER_MISSED_VALUE", 600),
      outcome("b", "u2", "CAPTURED_OPTIMAL", 0),
    ]);

    expect(metrics.passFail.passesPrimaryKillTest).toBe(true);
  });

  it("fails primary kill test below target user share", () => {
    const { metrics } = report([
      outcome("a", "u1", "USER_MISSED_VALUE", 600),
      outcome("b", "u2", "CAPTURED_OPTIMAL", 0),
      outcome("c", "u3", "CAPTURED_OPTIMAL", 0),
    ]);

    expect(metrics.passFail.passesPrimaryKillTest).toBe(false);
  });

  it("fails trust quality gate when enough matched recommendations exceed error threshold", () => {
    const outcomes = Array.from({ length: 10 }, (_, index) =>
      outcome(
        `o${index}`,
        `u${index}`,
        index < 2 ? "RECOMMENDATION_ERROR" : "CAPTURED_OPTIMAL",
        index < 2 ? 600 : 0,
        { recommendationEventId: `r${index}` },
      ),
    );
    const { metrics } = report(outcomes);

    expect(metrics.recommendationErrorRate).toBe(0.2);
    expect(metrics.passFail.passesTrustQualityGate).toBe(false);
  });

  it("fails data completeness gate when enough outcomes exceed inconclusive threshold", () => {
    const outcomes = Array.from({ length: 10 }, (_, index) =>
      outcome(
        `o${index}`,
        `u${index}`,
        index < 3 ? "INCONCLUSIVE" : "CAPTURED_OPTIMAL",
        0,
      ),
    );
    const { metrics } = report(outcomes);

    expect(metrics.inconclusiveRate).toBe(0.3);
    expect(metrics.passFail.passesDataCompletenessGate).toBe(false);
  });

  it("adds small sample reasons without hard failing trust gate", () => {
    const { metrics } = report([
      outcome("a", "u1", "RECOMMENDATION_ERROR", 6900, {
        recommendationEventId: "r1",
      }),
    ]);

    expect(metrics.passFail.passesTrustQualityGate).toBe(true);
    expect(metrics.passFail.reasons).toContain(
      "Sample size is small: only 1 matched recommendations.",
    );
  });

  it("keeps overall pass deterministic", () => {
    const { metrics } = report(
      [
        outcome("a", "u1", "USER_MISSED_VALUE", 6900),
        outcome("b", "u2", "CAPTURED_OPTIMAL", 0),
      ],
      { transactions: [] },
    );

    expect(metrics.passFail.overallPass).toBe(true);
  });
});

function report(
  outcomes: KillTestOutcomeDto[],
  options: {
    corrections?: Array<{ id: string; userId: string; createdAt: string }>;
    transactions?: [];
  } = {},
) {
  return calculateKillTestReport({
    startDate,
    endDate,
    meaningfulMissThresholdCents: 500,
    annualSubscriptionPriceCents: 6900,
    outcomes,
    corrections: options.corrections,
    transactions: options.transactions,
  });
}

function outcome(
  id: string,
  userId: string,
  outcomeType: KillTestOutcomeDto["outcomeType"],
  missedValueCents: number | null,
  options: {
    capturedValueCents?: number;
    recommendationEventId?: string;
    merchantName?: string;
    category?: string;
  } = {},
): KillTestOutcomeDto {
  return {
    id,
    userId,
    userEmail: `${userId}@example.com`,
    outcomeType,
    capturedValueCents: options.capturedValueCents ?? 100,
    missedValueCents,
    recommendationEventId: options.recommendationEventId,
    confidence: "HIGH",
    transaction: {
      id: `t-${id}`,
      transactionDate: "2026-01-10T00:00:00.000Z",
      amountCents: 5000,
      observedCategory: options.category ?? "DINING",
      merchantName: options.merchantName ?? "Starbucks",
    },
  };
}
