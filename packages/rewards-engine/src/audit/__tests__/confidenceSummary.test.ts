import { describe, expect, it } from "vitest";

import { buildConfidenceNotes } from "../confidenceSummary.js";
import type { WeeklyAuditItem } from "../weeklyReportTypes.js";

describe("weekly confidence notes", () => {
  it("returns sufficient confidence note when there are no caveats", () => {
    expect(
      buildConfidenceNotes({
        items: [item({ confidence: "HIGH" })],
        recommendationErrorCount: 0,
        inconclusiveCount: 0,
      }),
    ).toEqual(["Audited outcomes had sufficient confidence for this summary."]);
  });

  it("includes low, unknown, inconclusive, and recommendation error notes", () => {
    const notes = buildConfidenceNotes({
      items: [
        item({ confidence: "LOW" }),
        item({ confidence: "UNKNOWN", outcomeType: "INCONCLUSIVE" }),
      ],
      recommendationErrorCount: 1,
      inconclusiveCount: 1,
    });

    expect(notes.join(" ")).toContain("low-confidence");
    expect(notes.join(" ")).toContain("unknown confidence");
    expect(notes.join(" ")).toContain("recommendation error");
    expect(notes.join(" ")).toContain("inconclusive");
  });
});

function item(overrides: Partial<WeeklyAuditItem> = {}): WeeklyAuditItem {
  return {
    outcomeId: "outcome-1",
    transactionId: "transaction-1",
    transactionDate: "2026-05-08T12:00:00.000Z",
    merchantName: "Starbucks",
    amountCents: 5000,
    outcomeType: "CAPTURED_OPTIMAL",
    confidence: "HIGH",
    explanation: "Fixture",
    capturedValueCents: 100,
    missedValueCents: 0,
    expectedValueCents: 100,
    isMeaningfulMiss: false,
    actionText: "Keep using card.",
    warnings: [],
    ...overrides,
  };
}
