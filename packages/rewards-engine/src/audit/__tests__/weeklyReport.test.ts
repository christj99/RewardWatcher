import { describe, expect, it } from "vitest";

import { buildWeeklyAuditReport } from "../weeklyReport.js";
import type { WeeklyAuditOutcomeInput } from "../weeklyReportTypes.js";

const weekStart = "2026-05-01T00:00:00.000Z";
const weekEnd = "2026-05-08T00:00:00.000Z";

describe("weekly audit report", () => {
  it("empty outcomes returns a valid empty report", () => {
    const report = buildWeeklyAuditReport({ weekStart, weekEnd, outcomes: [] });

    expect(report.totalOutcomes).toBe(0);
    expect(report.topMiss).toBeNull();
    expect(report.recommendedAction).toContain("Import more transactions");
  });

  it("sums captured and missed values", () => {
    const report = buildWeeklyAuditReport({
      weekStart,
      weekEnd,
      outcomes: [
        outcome({ capturedValueCents: 100, missedValueCents: 50 }),
        outcome({
          outcomeId: "o2",
          capturedValueCents: 200,
          missedValueCents: 75,
        }),
      ],
    });

    expect(report.estimatedValueCapturedCents).toBe(300);
    expect(report.estimatedValueMissedCents).toBe(125);
  });

  it("only includes misses above threshold as meaningful", () => {
    const report = buildWeeklyAuditReport({
      weekStart,
      weekEnd,
      minMissedValueCents: 100,
      outcomes: [
        outcome({ outcomeId: "tiny", missedValueCents: 99 }),
        outcome({ outcomeId: "real", missedValueCents: 100 }),
      ],
    });

    expect(report.meaningfulMissCount).toBe(1);
    expect(report.meaningfulMissedValueCents).toBe(100);
  });

  it("selects top miss with deterministic tie-breaks", () => {
    const report = buildWeeklyAuditReport({
      weekStart,
      weekEnd,
      outcomes: [
        outcome({
          outcomeId: "b",
          missedValueCents: 500,
          confidence: "MEDIUM",
          transactionDate: "2026-05-02T00:00:00.000Z",
        }),
        outcome({
          outcomeId: "a",
          missedValueCents: 500,
          confidence: "HIGH",
          transactionDate: "2026-05-01T00:00:00.000Z",
        }),
      ],
    });

    expect(report.topMiss?.outcomeId).toBe("a");
  });

  it("counts recommendation errors separately", () => {
    const report = buildWeeklyAuditReport({
      weekStart,
      weekEnd,
      outcomes: [outcome({ outcomeType: "RECOMMENDATION_ERROR" })],
    });

    expect(report.recommendationErrorCount).toBe(1);
  });

  it("excludes inconclusive items by default but counts them", () => {
    const report = buildWeeklyAuditReport({
      weekStart,
      weekEnd,
      outcomes: [
        outcome({ outcomeType: "INCONCLUSIVE", confidence: "UNKNOWN" }),
      ],
    });

    expect(report.inconclusiveCount).toBe(1);
    expect(report.items).toHaveLength(0);
  });

  it("can include inconclusive and exclude unmatched from items", () => {
    const includeReport = buildWeeklyAuditReport({
      weekStart,
      weekEnd,
      includeInconclusive: true,
      outcomes: [
        outcome({ outcomeType: "INCONCLUSIVE", confidence: "UNKNOWN" }),
      ],
    });
    const excludeReport = buildWeeklyAuditReport({
      weekStart,
      weekEnd,
      includeUnmatched: false,
      outcomes: [outcome({ outcomeType: "UNMATCHED" })],
    });

    expect(includeReport.items).toHaveLength(1);
    expect(excludeReport.unmatchedCount).toBe(1);
    expect(excludeReport.items).toHaveLength(0);
  });

  it("uses top miss action, captured optimal action, and sorted item order", () => {
    const report = buildWeeklyAuditReport({
      weekStart,
      weekEnd,
      outcomes: [
        outcome({
          outcomeId: "captured",
          outcomeType: "CAPTURED_OPTIMAL",
          missedValueCents: 0,
        }),
        outcome({ outcomeId: "miss", missedValueCents: 250 }),
      ],
    });

    expect(report.recommendedAction).toBe(report.topMiss?.actionText);
    expect(report.items[0]?.outcomeId).toBe("miss");

    const capturedOnly = buildWeeklyAuditReport({
      weekStart,
      weekEnd,
      outcomes: [
        outcome({
          outcomeId: "captured",
          outcomeType: "CAPTURED_OPTIMAL",
          missedValueCents: 0,
        }),
      ],
    });
    expect(capturedOnly.recommendedAction).toContain("strong cards");
  });
});

function outcome(
  overrides: Partial<WeeklyAuditOutcomeInput> = {},
): WeeklyAuditOutcomeInput {
  return {
    outcomeId: "o1",
    transactionId: "t1",
    recommendationEventId: "r1",
    transactionDate: "2026-05-03T00:00:00.000Z",
    merchantName: "Starbucks",
    amountCents: 5000,
    outcomeType: "USER_MISSED_VALUE",
    confidence: "HIGH",
    explanation: "Fixture",
    actualCard: { id: "card-1", name: "Freedom Unlimited" },
    bestCard: { id: "card-2", name: "Amex Gold" },
    recommendedCard: { id: "card-2", name: "Amex Gold" },
    capturedValueCents: 100,
    missedValueCents: 200,
    expectedValueCents: 300,
    ...overrides,
  };
}
