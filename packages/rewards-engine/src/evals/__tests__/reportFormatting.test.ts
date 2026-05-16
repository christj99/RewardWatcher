import { describe, expect, it } from "vitest";

import {
  formatDollars,
  formatKillTestSummary,
  formatPercent,
} from "../reportFormatting.js";
import type { KillTestMetrics } from "../killTestTypes.js";

describe("kill-test report formatting", () => {
  it("formats dollars and percentages", () => {
    expect(formatDollars(12345)).toBe("$123.45");
    expect(formatPercent(12.345)).toBe("12.3%");
  });

  it("formats deterministic summary lines", () => {
    const lines = formatKillTestSummary(metricsFixture());

    expect(lines).toEqual([
      "Users evaluated: 6",
      "Users with meaningful miss: 3 (50.0%)",
      "Meaningful missed value: $123.45",
      "Users above subscription value: 1",
      "Recommendation error rate: 8.3%",
      "Inconclusive rate: 10.0%",
      "Overall pass: YES",
      "Reasons:",
      "- Kill-test gates passed for this evaluation window.",
    ]);
  });
});

function metricsFixture(): KillTestMetrics {
  return {
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-02-01T00:00:00.000Z",
    meaningfulMissThresholdCents: 500,
    annualSubscriptionPriceCents: 6900,
    totalUsersEvaluated: 6,
    totalTransactionsAudited: 10,
    totalOutcomes: 10,
    totalMatchedRecommendations: 12,
    usersWithAnyOutcome: 6,
    usersWithMeaningfulMiss: 3,
    percentUsersWithMeaningfulMiss: 50,
    usersAboveSubscriptionValue: 1,
    percentUsersAboveSubscriptionValue: 16.666,
    totalCapturedValueCents: 1000,
    totalMissedValueCents: 14000,
    totalMeaningfulMissedValueCents: 12345,
    averageMissedValuePerUserCents: 2333.333,
    averageMeaningfulMissedValuePerUserCents: 2057.5,
    medianMissedValuePerUserCents: 1000,
    medianMeaningfulMissedValuePerUserCents: 600,
    recommendationErrorCount: 1,
    recommendationErrorRate: 0.083,
    inconclusiveCount: 1,
    inconclusiveRate: 0.1,
    userOverrideCount: 0,
    userOverrideRate: 0,
    unmatchedOutcomeCount: 1,
    unmatchedOutcomeRate: 0.1,
    correctionCount: 1,
    correctionsPer100Outcomes: 10,
    outcomeTypeCounts: {
      CAPTURED_OPTIMAL: 4,
      USER_MISSED_VALUE: 3,
      RECOMMENDATION_ERROR: 1,
      UNMATCHED: 1,
      USER_OVERRIDE: 0,
      INCONCLUSIVE: 1,
    },
    topMissCategories: [],
    topMissMerchants: [],
    topRecommendationErrorMerchants: [],
    passFail: {
      passesPrimaryKillTest: true,
      passesTrustQualityGate: true,
      passesDataCompletenessGate: true,
      overallPass: true,
      reasons: ["Kill-test gates passed for this evaluation window."],
    },
  };
}
