import { combineConfidence } from "../confidence.js";
import type { RecommendedCardResult } from "../types.js";
import type {
  AuditOutcomeComputationInput,
  AuditOutcomeResult,
} from "./auditTypes.js";

export function computeAuditOutcome(
  input: AuditOutcomeComputationInput,
): AuditOutcomeResult {
  const thresholdCents = input.thresholdCents ?? 100;
  const best = input.bestRecommendationResult?.primaryRecommendation;
  const actual = input.actualCardValue;
  const matched = input.matchedRecommendation ?? null;
  const warnings = [
    ...(input.match?.warnings ?? []),
    ...(input.bestRecommendationResult?.warnings ?? []),
    ...(actual?.warnings ?? []),
  ];

  if (!input.transaction.userCardId || !actual) {
    return inconclusive(input, "missing actual card", warnings);
  }

  if (!best) {
    return inconclusive(input, "missing best recommendation result", warnings);
  }

  if (actual.expectedValueCents === undefined) {
    return inconclusive(
      input,
      "actual card value could not be computed",
      warnings,
    );
  }

  const capturedValueCents = actual.expectedValueCents;
  const bestValueCents = best.expectedValueCents;
  const recommendedResult = matched
    ? findRecommendedResult(input, matched.recommendedUserCardId)
    : null;
  const expectedValueCents = matched
    ? toNumber(matched.expectedValueCents)
    : bestValueCents;
  const recommendedComparableValue =
    recommendedResult?.expectedValueCents ?? expectedValueCents;
  const missedValueCents = Math.max(0, bestValueCents - capturedValueCents);
  const recommendationWasCorrect =
    matched === null
      ? null
      : Math.max(0, bestValueCents - recommendedComparableValue) <=
        thresholdCents;

  if (!matched) {
    return baseResult(input, {
      outcomeType: "UNMATCHED",
      best,
      expectedValueCents,
      capturedValueCents,
      missedValueCents,
      recommendationWasCorrect: null,
      confidence: combineConfidence([best.confidence, actual.confidence]),
      explanation: appendOfferContext(
        "No prior recommendation was matched, but this transaction was still analyzed.",
        best,
        warnings,
      ),
      warnings,
    });
  }

  if (
    missedValueCents <= thresholdCents ||
    actual.userCardId === best.userCardId
  ) {
    return baseResult(input, {
      outcomeType: "CAPTURED_OPTIMAL",
      best,
      expectedValueCents,
      capturedValueCents,
      missedValueCents,
      recommendationWasCorrect,
      confidence: combineConfidence([best.confidence, actual.confidence]),
      explanation: appendOfferContext(
        "You used the best card we found for this transaction.",
        best,
        warnings,
      ),
      warnings,
    });
  }

  if (input.hasUserOverride) {
    return baseResult(input, {
      outcomeType: "USER_OVERRIDE",
      best,
      expectedValueCents,
      capturedValueCents,
      missedValueCents,
      recommendationWasCorrect,
      confidence: combineConfidence([best.confidence, actual.confidence]),
      explanation: appendOfferContext(
        "A personal preference applied, so this transaction is treated as a user override.",
        best,
        warnings,
      ),
      warnings,
    });
  }

  if (!recommendationWasCorrect) {
    return baseResult(input, {
      outcomeType: "RECOMMENDATION_ERROR",
      best,
      expectedValueCents,
      capturedValueCents,
      missedValueCents,
      recommendationWasCorrect: false,
      confidence: combineConfidence([best.confidence, actual.confidence]),
      explanation: appendOfferContext(
        "The original recommendation appears to have been wrong because the posted transaction changed the best available card.",
        best,
        warnings,
      ),
      warnings,
    });
  }

  return baseResult(input, {
    outcomeType: "USER_MISSED_VALUE",
    best,
    expectedValueCents,
    capturedValueCents,
    missedValueCents,
    recommendationWasCorrect: true,
    confidence: combineConfidence([best.confidence, actual.confidence]),
    explanation: appendOfferContext(
      `You used ${actual.cardName ?? "the actual card"}, but ${best.cardName} appears to have been better for this transaction.`,
      best,
      warnings,
    ),
    warnings,
  });
}

function baseResult(
  input: AuditOutcomeComputationInput,
  values: Omit<
    AuditOutcomeResult,
    | "transactionId"
    | "recommendationEventId"
    | "actualUserCardId"
    | "bestUserCardId"
    | "recommendedUserCardId"
    | "match"
  > & { best: RecommendedCardResult },
): AuditOutcomeResult {
  const { best, ...rest } = values;

  return {
    ...rest,
    transactionId: input.transaction.id,
    recommendationEventId: input.matchedRecommendation?.id ?? null,
    actualUserCardId: input.actualCardValue?.userCardId ?? null,
    bestUserCardId: best.userCardId,
    recommendedUserCardId:
      input.matchedRecommendation?.recommendedUserCardId ?? null,
    ...(input.match ? { match: input.match } : {}),
  };
}

function inconclusive(
  input: AuditOutcomeComputationInput,
  reason: string,
  warnings: string[],
): AuditOutcomeResult {
  return {
    outcomeType: "INCONCLUSIVE",
    recommendationEventId: input.matchedRecommendation?.id ?? null,
    transactionId: input.transaction.id,
    actualUserCardId: input.transaction.userCardId ?? null,
    recommendedUserCardId:
      input.matchedRecommendation?.recommendedUserCardId ?? null,
    recommendationWasCorrect: null,
    confidence: "UNKNOWN",
    explanation: `We could not confidently audit this transaction because ${reason}.`,
    ...(input.match ? { match: input.match } : {}),
    warnings,
  };
}

function findRecommendedResult(
  input: AuditOutcomeComputationInput,
  userCardId?: string | null,
): RecommendedCardResult | null {
  if (!userCardId || !input.bestRecommendationResult) {
    return null;
  }

  return (
    [
      input.bestRecommendationResult.primaryRecommendation,
      ...input.bestRecommendationResult.alternatives,
    ].find((candidate) => candidate.userCardId === userCardId) ?? null
  );
}

function appendOfferContext(
  explanation: string,
  best: RecommendedCardResult,
  warnings: string[],
): string {
  if ((best.offerValueCents ?? 0) > 0) {
    return `${explanation} Activated offer value was included in the best-card estimate.`;
  }
  if (warnings.some((warning) => warning.toLowerCase().includes("offer"))) {
    return `${explanation} An available offer may require activation, so offer value was treated conservatively.`;
  }
  return explanation;
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}
