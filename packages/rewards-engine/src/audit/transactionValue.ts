import type { RecommendationResult } from "../types.js";
import type { ActualCardValueResult } from "./auditTypes.js";

export function computeActualCardValueFromRecommendationResult(
  result: RecommendationResult,
  userCardId?: string | null,
): ActualCardValueResult {
  if (!userCardId) {
    return {
      ...(userCardId === null ? { userCardId } : {}),
      confidence: "UNKNOWN",
      explanation: "Actual card was missing for this transaction.",
      warnings: ["Actual user card was not provided."],
    };
  }

  const card = [result.primaryRecommendation, ...result.alternatives].find(
    (candidate) => candidate.userCardId === userCardId,
  );

  if (!card) {
    return {
      userCardId,
      confidence: "UNKNOWN",
      expectedValueCents: 0,
      explanation:
        "Actual card could not be scored from the deterministic ranking result.",
      warnings: ["Actual card was not eligible in the replayed ranking."],
    };
  }

  return {
    userCardId: card.userCardId,
    cardId: card.cardId,
    cardName: card.cardName,
    expectedValueCents: card.expectedValueCents,
    ...(card.matchedRuleId ? { matchedRuleId: card.matchedRuleId } : {}),
    confidence: card.confidence,
    explanation: card.explanationParts.join(" "),
    warnings: card.warnings,
  };
}
