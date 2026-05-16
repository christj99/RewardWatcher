import { describe, expect, it } from "vitest";

import type { RecommendationResult } from "../../types.js";
import { computeActualCardValueFromRecommendationResult } from "../transactionValue.js";

describe("transaction value", () => {
  it("finds actual card value in ranking result", () => {
    const result = computeActualCardValueFromRecommendationResult(
      recommendationResult(),
      "uc-2",
    );

    expect(result.expectedValueCents).toBe(255);
    expect(result.confidence).toBe("MEDIUM");
  });

  it("returns unknown when actual card is missing", () => {
    const result = computeActualCardValueFromRecommendationResult(
      recommendationResult(),
      null,
    );

    expect(result.confidence).toBe("UNKNOWN");
  });
});

function recommendationResult(): RecommendationResult {
  return {
    input: {
      userId: "user-1",
      purchaseAmountCents: 5000,
      timestamp: "2026-05-08T12:00:00.000Z",
      lens: "PRACTICAL",
      context: "IMPORTED_TRANSACTION_REPLAY",
    },
    resolvedMerchant: {
      id: "merchant-1",
      name: "Starbucks",
      category: "DINING",
      confidence: "HIGH",
      resolutionMethod: "ID",
      warnings: [],
    },
    expectedCategory: "DINING",
    primaryRecommendation: {
      rank: 1,
      userCardId: "uc-1",
      cardId: "card-1",
      cardName: "American Express Gold Card",
      issuerName: "American Express",
      rewardCurrencyCode: "AMEX_MR",
      effectiveMultiplier: 4,
      expectedPoints: 200,
      expectedValueCents: 320,
      confidence: "HIGH",
      explanationParts: [],
      warnings: [],
    },
    alternatives: [
      {
        rank: 2,
        userCardId: "uc-2",
        cardId: "card-2",
        cardName: "Chase Sapphire Preferred",
        issuerName: "Chase",
        rewardCurrencyCode: "CHASE_UR",
        effectiveMultiplier: 3,
        expectedPoints: 150,
        expectedValueCents: 255,
        confidence: "MEDIUM",
        explanationParts: ["fixture"],
        warnings: [],
      },
    ],
    warnings: [],
    confidence: "HIGH",
    explanation: "Fixture.",
    inputSnapshot: {},
    rankingSnapshot: {},
    ruleSnapshot: {},
  };
}
