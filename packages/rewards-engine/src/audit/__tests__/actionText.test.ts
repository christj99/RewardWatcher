import { describe, expect, it } from "vitest";

import { buildWeeklyActionText } from "../actionText.js";
import type { WeeklyAuditOutcomeInput } from "../weeklyReportTypes.js";

describe("weekly action text", () => {
  it.each([
    ["CAPTURED_OPTIMAL", "Keep using"],
    ["USER_MISSED_VALUE", "Use Amex Gold instead of Freedom Unlimited"],
    ["RECOMMENDATION_ERROR", "We may need to correct"],
    ["UNMATCHED", "You may want to use Amex Gold"],
    ["USER_OVERRIDE", "personal preference"],
    ["INCONCLUSIVE", "Add the card used"],
  ] as const)("generates text for %s", (outcomeType, expected) => {
    expect(buildWeeklyActionText(item({ outcomeType }))).toContain(expected);
  });
});

function item(
  overrides: Partial<WeeklyAuditOutcomeInput> = {},
): WeeklyAuditOutcomeInput {
  return {
    outcomeId: "outcome-1",
    transactionId: "transaction-1",
    transactionDate: "2026-05-08T12:00:00.000Z",
    merchantName: "Starbucks",
    amountCents: 5000,
    outcomeType: "USER_MISSED_VALUE",
    confidence: "HIGH",
    explanation: "Fixture",
    actualCard: { id: "card-1", name: "Freedom Unlimited" },
    bestCard: { id: "card-2", name: "Amex Gold" },
    missedValueCents: 250,
    ...overrides,
  };
}
