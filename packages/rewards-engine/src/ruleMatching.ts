import { compareConfidence, downgradeConfidence } from "./confidence.js";
import type {
  EngineCapLedger,
  EngineEarningRule,
  EngineUserPreferenceRule,
  MerchantCategory,
} from "./types.js";
import { decimalToNumber } from "./valueMath.js";

export type RuleMatch = {
  rule: EngineEarningRule;
  effectiveAmountCents: number;
  fallbackRule?: EngineEarningRule | undefined;
  fallbackAmountCents: number;
  capLedger?: EngineCapLedger | undefined;
  confidence: EngineEarningRule["confidence"];
  warnings: string[];
};

export type MatchRulesForCardInput = {
  cardId: string;
  merchantId?: string | undefined;
  category: MerchantCategory;
  amountCents: number;
  timestamp: Date;
  rules: EngineEarningRule[];
  capLedgers: EngineCapLedger[];
};

export function filterActiveRules(
  rules: EngineEarningRule[],
  timestamp: Date,
): EngineEarningRule[] {
  return rules.filter((rule) => {
    const startsAt = rule.startsAt ? new Date(rule.startsAt) : null;
    const endsAt = rule.endsAt ? new Date(rule.endsAt) : null;

    return (
      (!startsAt || startsAt <= timestamp) && (!endsAt || endsAt >= timestamp)
    );
  });
}

export function matchRuleForCard(
  input: MatchRulesForCardInput,
): RuleMatch | null {
  const activeRules = filterActiveRules(
    input.rules.filter((rule) => rule.cardId === input.cardId),
    input.timestamp,
  );

  const baseRule = chooseBestRule(
    activeRules.filter((rule) => !rule.merchantId && !rule.category),
  );

  const candidateGroups = [
    activeRules.filter(
      (rule) => rule.merchantId && rule.merchantId === input.merchantId,
    ),
    activeRules.filter(
      (rule) => !rule.merchantId && rule.category === input.category,
    ),
    baseRule ? [baseRule] : [],
  ];

  for (const candidates of candidateGroups) {
    const rule = chooseBestRule(candidates);
    if (!rule) {
      continue;
    }

    const cappedMatch = applyCap(rule, baseRule, input);
    if (!cappedMatch) {
      continue;
    }

    const warnings = [...cappedMatch.warnings];
    const confidence = rule.activationRequired
      ? downgradeConfidence(rule.confidence)
      : rule.confidence;

    if (rule.activationRequired) {
      warnings.push("This rule may require activation.");
    }

    return {
      ...cappedMatch,
      confidence,
      warnings,
    };
  }

  return null;
}

export function chooseBestRule(
  rules: EngineEarningRule[],
): EngineEarningRule | undefined {
  return [...rules].sort((a, b) => {
    const multiplierDelta =
      decimalToNumber(b.multiplier) - decimalToNumber(a.multiplier);
    if (multiplierDelta !== 0) {
      return multiplierDelta;
    }

    const confidenceDelta = compareConfidence(b.confidence, a.confidence);
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return a.id.localeCompare(b.id);
  })[0];
}

export function isPreferenceApplicable(
  preference: EngineUserPreferenceRule,
  options: {
    cardId?: string;
    merchantId?: string | undefined;
    category: MerchantCategory;
  },
): boolean {
  const merchantMatches =
    !preference.merchantId || preference.merchantId === options.merchantId;
  const categoryMatches =
    !preference.category || preference.category === options.category;
  const cardMatches =
    !preference.cardId || preference.cardId === options.cardId;

  return merchantMatches && categoryMatches && cardMatches;
}

function applyCap(
  rule: EngineEarningRule,
  baseRule: EngineEarningRule | undefined,
  input: MatchRulesForCardInput,
): Omit<RuleMatch, "confidence"> | null {
  if (!rule.capAmountCents || !rule.capPeriod) {
    return {
      rule,
      effectiveAmountCents: input.amountCents,
      fallbackRule: undefined,
      fallbackAmountCents: 0,
      capLedger: undefined,
      warnings: [],
    };
  }

  const ledger = input.capLedgers.find(
    (capLedger) =>
      capLedger.earningRuleId === rule.id &&
      new Date(capLedger.periodStart) <= input.timestamp &&
      new Date(capLedger.periodEnd) >= input.timestamp,
  );
  const usedAmountCents = ledger?.usedAmountCents ?? 0;
  const remainingCapCents = Math.max(0, rule.capAmountCents - usedAmountCents);

  if (remainingCapCents <= 0) {
    if (baseRule && baseRule.id !== rule.id) {
      return {
        rule: baseRule,
        effectiveAmountCents: input.amountCents,
        fallbackRule: undefined,
        fallbackAmountCents: 0,
        capLedger: ledger,
        warnings: [
          "The higher earning capped rule is exhausted; using fallback base rule.",
        ],
      };
    }

    return null;
  }

  if (
    remainingCapCents < input.amountCents &&
    baseRule &&
    baseRule.id !== rule.id
  ) {
    return {
      rule,
      effectiveAmountCents: remainingCapCents,
      fallbackRule: baseRule,
      fallbackAmountCents: input.amountCents - remainingCapCents,
      capLedger: ledger,
      warnings: [
        "The purchase partially exceeds this rule's cap; remaining amount uses fallback base rule.",
      ],
    };
  }

  return {
    rule,
    effectiveAmountCents: input.amountCents,
    fallbackRule: undefined,
    fallbackAmountCents: 0,
    capLedger: ledger,
    warnings: [],
  };
}
