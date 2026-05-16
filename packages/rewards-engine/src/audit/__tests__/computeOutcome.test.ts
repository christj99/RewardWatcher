import { describe, expect, it } from "vitest";

import type {
  ActualCardValueResult,
  AuditOutcomeComputationInput,
  AuditRecommendationCandidate,
  AuditTransactionInput,
} from "../auditTypes.js";
import { computeAuditOutcome } from "../computeOutcome.js";

describe("audit outcome computation", () => {
  it("captured optimal when actual card equals best card", () => {
    const result = computeAuditOutcome(input({ actualUserCardId: "uc-best" }));

    expect(result.outcomeType).toBe("CAPTURED_OPTIMAL");
    expect(result.recommendationWasCorrect).toBe(true);
  });

  it("user missed value when actual card is worse and recommendation was right", () => {
    const result = computeAuditOutcome(input());

    expect(result.outcomeType).toBe("USER_MISSED_VALUE");
    expect(result.missedValueCents).toBe(200);
    expect(result.recommendationWasCorrect).toBe(true);
  });

  it("recommendation error when matched recommendation differs from best card", () => {
    const result = computeAuditOutcome(
      input({
        matchedRecommendation: recommendation({
          recommendedUserCardId: "uc-old",
          expectedValueCents: 100,
        }),
      }),
    );

    expect(result.outcomeType).toBe("RECOMMENDATION_ERROR");
    expect(result.recommendationWasCorrect).toBe(false);
  });

  it("unmatched transaction still computes missed value", () => {
    const result = computeAuditOutcome(input({ matchedRecommendation: null }));

    expect(result.outcomeType).toBe("UNMATCHED");
    expect(result.missedValueCents).toBe(200);
  });

  it("inconclusive when actual card missing", () => {
    const result = computeAuditOutcome(
      input({
        transaction: { ...transaction, userCardId: null },
        actualCardValue: null,
      }),
    );

    expect(result.outcomeType).toBe("INCONCLUSIVE");
  });

  it("missed value threshold suppresses tiny misses", () => {
    const result = computeAuditOutcome(
      input({
        actualCardValue: actualValue({ expectedValueCents: 390 }),
      }),
    );

    expect(result.outcomeType).toBe("CAPTURED_OPTIMAL");
  });

  it("recommendationWasCorrect true for near-best within threshold", () => {
    const result = computeAuditOutcome(
      input({
        matchedRecommendation: recommendation({ expectedValueCents: 350 }),
      }),
    );

    expect(result.recommendationWasCorrect).toBe(true);
  });

  it("returns deterministic explanation text", () => {
    const result = computeAuditOutcome(input());

    expect(result.explanation).toContain("appears to have been better");
  });
});

const transaction: AuditTransactionInput = {
  id: "txn-1",
  userId: "user-1",
  userCardId: "uc-actual",
  rawMerchantName: "Starbucks",
  amountCents: 5000,
  currencyCode: "USD",
  transactionDate: "2026-05-08T12:00:00.000Z",
  source: "MANUAL",
};

function input(
  overrides: Partial<AuditOutcomeComputationInput> & {
    actualUserCardId?: string;
  } = {},
): AuditOutcomeComputationInput {
  const actualUserCardId = overrides.actualUserCardId ?? "uc-actual";
  return {
    transaction: {
      ...transaction,
      userCardId: actualUserCardId,
      ...(overrides.transaction ?? {}),
    },
    matchedRecommendation:
      overrides.matchedRecommendation === undefined
        ? recommendation()
        : overrides.matchedRecommendation,
    bestRecommendationResult: {
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
        userCardId: "uc-best",
        cardId: "card-best",
        cardName: "American Express Gold Card",
        issuerName: "American Express",
        rewardCurrencyCode: "AMEX_MR",
        effectiveMultiplier: 4,
        expectedPoints: 200,
        expectedValueCents: 400,
        confidence: "HIGH",
        explanationParts: [],
        warnings: [],
      },
      alternatives: [
        {
          rank: 2,
          userCardId: actualUserCardId,
          cardId: "card-actual",
          cardName: "Chase Freedom Unlimited",
          issuerName: "Chase",
          rewardCurrencyCode: "CHASE_UR",
          effectiveMultiplier: 3,
          expectedPoints: 150,
          expectedValueCents: 200,
          confidence: "HIGH",
          explanationParts: [],
          warnings: [],
        },
      ],
      warnings: [],
      confidence: "HIGH",
      explanation: "Fixture.",
      inputSnapshot: {},
      rankingSnapshot: {},
      ruleSnapshot: {},
    },
    actualCardValue:
      overrides.actualCardValue === undefined
        ? actualValue({ userCardId: actualUserCardId })
        : overrides.actualCardValue,
    ...overrides,
  };
}

function recommendation(
  overrides: Partial<AuditRecommendationCandidate> = {},
): AuditRecommendationCandidate {
  return {
    id: "rec-1",
    userId: "user-1",
    merchantId: "merchant-1",
    purchaseAmountCents: 5000,
    context: "MANUAL_LOOKUP",
    lens: "PRACTICAL",
    recommendedUserCardId: "uc-best",
    recommendedCardId: "card-best",
    expectedCategory: "DINING",
    expectedValueCents: 400,
    confidence: "HIGH",
    explanation: "Fixture.",
    createdAt: "2026-05-08T10:00:00.000Z",
    ...overrides,
  };
}

function actualValue(
  overrides: Partial<ActualCardValueResult> = {},
): ActualCardValueResult {
  return {
    userCardId: "uc-actual",
    cardId: "card-actual",
    cardName: "Chase Freedom Unlimited",
    expectedValueCents: 200,
    confidence: "HIGH",
    explanation: "Fixture.",
    warnings: [],
    ...overrides,
  };
}
