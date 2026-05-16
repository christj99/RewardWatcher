import type {
  Lens,
  MerchantCategory,
  RecommendedCardResult,
  ResolvedMerchant,
} from "./types.js";

export function buildCardExplanationParts(options: {
  cardName: string;
  merchantName: string;
  category: MerchantCategory;
  multiplier: number;
  rewardCurrencyCode: string;
  lens: Lens;
  expectedValueCents: number;
  confidence: string;
  warnings: string[];
}): string[] {
  const parts = [
    `${options.cardName} earns ${formatMultiplier(options.multiplier)}x ${options.rewardCurrencyCode}.`,
    `The merchant is treated as ${options.category} under the ${options.lens} lens.`,
    `Expected value is ${formatCents(options.expectedValueCents)}.`,
  ];

  if (options.confidence !== "HIGH") {
    parts.push(`Confidence is ${options.confidence}.`);
  }

  parts.push(...options.warnings);
  return parts;
}

export function buildPrimaryExplanation(options: {
  recommendation: RecommendedCardResult;
  resolvedMerchant: ResolvedMerchant;
  expectedCategory: MerchantCategory;
  lens: Lens;
}): string {
  const merchantName =
    options.resolvedMerchant.name ?? "the unresolved merchant";

  return `${options.recommendation.cardName} is recommended because ${merchantName} is treated as ${options.expectedCategory} and this card earns ${formatMultiplier(options.recommendation.effectiveMultiplier)}x ${options.recommendation.rewardCurrencyCode} under the ${options.lens} lens.`;
}

export function formatCents(valueCents: number): string {
  return `$${(valueCents / 100).toFixed(2)}`;
}

function formatMultiplier(multiplier: number): string {
  return Number.isInteger(multiplier)
    ? multiplier.toFixed(0)
    : multiplier.toString();
}
