import { combineConfidence, compareConfidence } from "./confidence.js";
import {
  MerchantNotFoundError,
  InvalidPurchaseAmountError,
  NoEligibleEarningRulesError,
  UserHasNoActiveCardsError,
} from "./errors.js";
import {
  buildCardExplanationParts,
  buildPrimaryExplanation,
} from "./explanations.js";
import {
  resolveExpectedCategory,
  resolveMerchant,
} from "./merchantResolution.js";
import type { RewardsEngineRepository } from "./repositories.js";
import {
  isPreferenceApplicable,
  matchRuleForCard,
  type RuleMatch,
} from "./ruleMatching.js";
import type {
  ConfidenceLevel,
  EngineCurrencyValuation,
  EngineIssuerOffer,
  EngineUserCard,
  MerchantCategory,
  NormalizedRecommendationInput,
  RecommendationInput,
  RecommendationResult,
  RecommendedCardResult,
} from "./types.js";
import {
  computeExpectedValueCents,
  computeValueCents,
  decimalToNumber,
  roundValueCents,
} from "./valueMath.js";

export async function recommendCardForPurchase(
  input: RecommendationInput,
  repository: RewardsEngineRepository,
): Promise<RecommendationResult> {
  const normalizedInput = normalizeRecommendationInput(input);
  const wallet = (
    await repository.getUserWallet(normalizedInput.userId)
  ).filter((userCard) => userCard.isActive);

  if (wallet.length === 0) {
    throw new UserHasNoActiveCardsError(normalizedInput.userId);
  }

  const resolvedMerchant = await resolveMerchant(normalizedInput, repository);
  if (input.merchantId && !resolvedMerchant.id) {
    throw new MerchantNotFoundError(input.merchantId);
  }

  const postingProfiles = resolvedMerchant.id
    ? await repository.getMerchantPostingProfiles(resolvedMerchant.id)
    : [];
  const categoryResolution = resolveExpectedCategory(
    resolvedMerchant,
    postingProfiles,
  );
  const categoryWarnings = [...categoryResolution.warnings];
  if (normalizedInput.categoryOverride) {
    categoryWarnings.push(
      normalizedInput.categoryOverrideReason ??
        "A category override was applied for deterministic audit replay.",
    );
  }
  const preferences = normalizedInput.ignoreUserPreferences
    ? []
    : await repository.getUserPreferenceRules(
        normalizedInput.userId,
        resolvedMerchant.id,
        normalizedInput.categoryOverride ?? categoryResolution.category,
      );

  const ignoreCategoryPreference = preferences.find(
    (preference) =>
      preference.preferenceType === "IGNORE_CATEGORY" &&
      isPreferenceApplicable(preference, {
        merchantId: resolvedMerchant.id,
        category: categoryResolution.category,
      }),
  );
  const expectedCategory = ignoreCategoryPreference
    ? "UNKNOWN"
    : normalizedInput.categoryOverride
      ? normalizedInput.categoryOverride
      : categoryResolution.category;

  const cardIds = wallet.map((userCard) => userCard.cardId);
  const rules = await repository.getEarningRulesForCards(
    cardIds,
    normalizedInput.timestamp,
  );
  const currencyIds = [...new Set(rules.map((rule) => rule.rewardCurrency.id))];
  const valuations = await repository.getCurrencyValuations(
    currencyIds,
    normalizedInput.lens,
    normalizedInput.timestamp,
  );
  const capLedgers = await repository.getCapLedgers(
    normalizedInput.userId,
    wallet.map((userCard) => userCard.id),
    normalizedInput.timestamp,
  );
  const offers = repository.getActiveOffersForUser
    ? await repository.getActiveOffersForUser(
        normalizedInput.userId,
        wallet.map((userCard) => userCard.id),
        resolvedMerchant.id,
        expectedCategory,
        normalizedInput.timestamp,
      )
    : [];
  const offerCurrencyIds = offers
    .map((offer) => offer.bonusCurrency?.id ?? offer.bonusCurrencyId)
    .filter((currencyId): currencyId is string => Boolean(currencyId));
  const allCurrencyIds = [...new Set([...currencyIds, ...offerCurrencyIds])];
  const allValuations =
    offerCurrencyIds.length > 0
      ? await repository.getCurrencyValuations(
          allCurrencyIds,
          normalizedInput.lens,
          normalizedInput.timestamp,
        )
      : valuations;

  const excludedWarnings: string[] = [];
  const consideredResults: Array<
    RecommendedCardResult & { preferTieBreak: boolean }
  > = [];
  const usedRuleIds: string[] = [];
  const usedValuationIds: string[] = [];
  const usedCapLedgerIds: string[] = [];
  const usedPreferenceRuleIds: string[] = [];
  const appliedOfferIds: string[] = [];
  const availableButNotActivatedOfferIds: string[] = [];

  for (const userCard of wallet) {
    const avoidPreference = preferences.find(
      (preference) =>
        preference.preferenceType === "AVOID_CARD" &&
        isPreferenceApplicable(preference, {
          cardId: userCard.cardId,
          merchantId: resolvedMerchant.id,
          category: expectedCategory,
        }),
    );

    if (avoidPreference) {
      usedPreferenceRuleIds.push(avoidPreference.id);
      excludedWarnings.push(
        `${userCard.card.name} was excluded due to your preference.`,
      );
      continue;
    }

    const match = matchRuleForCard({
      cardId: userCard.cardId,
      merchantId: resolvedMerchant.id,
      category: expectedCategory,
      amountCents: normalizedInput.purchaseAmountCents,
      timestamp: normalizedInput.timestamp,
      rules,
      capLedgers,
    });

    if (!match) {
      continue;
    }

    const valuation = findValuation(
      allValuations,
      match.rule.rewardCurrency.id,
    );
    if (!valuation) {
      continue;
    }

    const preferTieBreak = preferences.some(
      (preference) =>
        preference.preferenceType === "PREFER_CARD" &&
        isPreferenceApplicable(preference, {
          cardId: userCard.cardId,
          merchantId: resolvedMerchant.id,
          category: expectedCategory,
        }),
    );
    if (preferTieBreak) {
      usedPreferenceRuleIds.push(
        ...preferences
          .filter((preference) => preference.preferenceType === "PREFER_CARD")
          .map((preference) => preference.id),
      );
    }

    const customNotes = preferences
      .filter(
        (preference) =>
          preference.preferenceType === "CUSTOM_NOTE" &&
          isPreferenceApplicable(preference, {
            cardId: userCard.cardId,
            merchantId: resolvedMerchant.id,
            category: expectedCategory,
          }),
      )
      .map((preference) => preference.reason)
      .filter((note): note is string => Boolean(note));

    const cardResult = scoreUserCard({
      userCard,
      match,
      valuation,
      normalizedInput,
      merchantName:
        resolvedMerchant.name ??
        normalizedInput.merchantName ??
        "Unknown merchant",
      expectedCategory,
      merchantConfidence: categoryResolution.confidence,
      customNotes,
      offers,
      valuations: allValuations,
    });

    consideredResults.push({ ...cardResult, preferTieBreak });
    usedRuleIds.push(match.rule.id);
    usedValuationIds.push(valuation.id);
    if (match.fallbackRule) {
      usedRuleIds.push(match.fallbackRule.id);
    }
    if (match.capLedger) {
      usedCapLedgerIds.push(match.capLedger.id);
    }
    appliedOfferIds.push(...(cardResult.appliedOfferIds ?? []));
    availableButNotActivatedOfferIds.push(
      ...(cardResult.availableButNotActivatedOfferIds ?? []),
    );
  }

  if (consideredResults.length === 0) {
    throw new NoEligibleEarningRulesError();
  }

  const rankedResults = consideredResults
    .sort((a, b) => {
      const valueDelta = b.expectedValueCents - a.expectedValueCents;
      if (valueDelta !== 0) {
        return valueDelta;
      }

      const confidenceDelta = compareConfidence(b.confidence, a.confidence);
      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }

      if (a.preferTieBreak !== b.preferTieBreak) {
        return a.preferTieBreak ? -1 : 1;
      }

      const nameDelta = a.cardName.localeCompare(b.cardName);
      if (nameDelta !== 0) {
        return nameDelta;
      }

      return a.userCardId.localeCompare(b.userCardId);
    })
    .map((result, index) => {
      const { preferTieBreak, ...rankedResult } = result;
      void preferTieBreak;
      return {
        ...rankedResult,
        rank: index + 1,
      };
    });

  const primaryRecommendation = rankedResults[0];
  if (!primaryRecommendation) {
    throw new NoEligibleEarningRulesError();
  }

  const warnings = [
    ...resolvedMerchant.warnings,
    ...categoryWarnings,
    ...(ignoreCategoryPreference
      ? ["A user preference asked this category to be ignored."]
      : []),
    ...excludedWarnings,
    ...rankedResults.flatMap((result) => result.warnings),
  ];

  const inputSnapshot = {
    originalInput: input,
    normalizedPurchaseAmountCents: normalizedInput.purchaseAmountCents,
    timestamp: normalizedInput.timestamp.toISOString(),
    lens: normalizedInput.lens,
    context: normalizedInput.context,
    resolvedMerchant,
    expectedCategory,
    categoryOverride: normalizedInput.categoryOverride,
    categoryOverrideReason: normalizedInput.categoryOverrideReason,
    ignoreUserPreferences: normalizedInput.ignoreUserPreferences,
  };
  const rankingSnapshot = {
    rankedCards: rankedResults.map((result) => ({
      rank: result.rank,
      userCardId: result.userCardId,
      cardId: result.cardId,
      cardName: result.cardName,
      expectedValueCents: result.expectedValueCents,
      confidence: result.confidence,
      matchedRuleId: result.matchedRuleId,
      appliedOfferIds: result.appliedOfferIds ?? [],
      availableButNotActivatedOfferIds:
        result.availableButNotActivatedOfferIds ?? [],
      offerValueCents: result.offerValueCents ?? 0,
      warnings: result.warnings,
    })),
  };
  const ruleSnapshot = {
    matchedEarningRuleIds: [...new Set(usedRuleIds)].sort(),
    valuationIds: [...new Set(usedValuationIds)].sort(),
    capLedgerIds: [...new Set(usedCapLedgerIds)].sort(),
    preferenceRuleIds: [...new Set(usedPreferenceRuleIds)].sort(),
    appliedOfferIds: [...new Set(appliedOfferIds)].sort(),
    availableButNotActivatedOfferIds: [
      ...new Set(availableButNotActivatedOfferIds),
    ].sort(),
    merchantPostingProfileIds: categoryResolution.postingProfileId
      ? [categoryResolution.postingProfileId]
      : [],
  };

  return {
    input: {
      userId: normalizedInput.userId,
      merchantId: normalizedInput.merchantId,
      merchantUrl: normalizedInput.merchantUrl,
      merchantName: normalizedInput.merchantName,
      purchaseAmountCents: normalizedInput.purchaseAmountCents,
      timestamp: normalizedInput.timestamp.toISOString(),
      lens: normalizedInput.lens,
      context: normalizedInput.context,
    },
    resolvedMerchant,
    expectedCategory,
    primaryRecommendation,
    alternatives: rankedResults.slice(1),
    warnings,
    confidence: combineConfidence([
      primaryRecommendation.confidence,
      categoryResolution.confidence,
    ]),
    explanation: buildPrimaryExplanation({
      recommendation: primaryRecommendation,
      resolvedMerchant,
      expectedCategory,
      lens: normalizedInput.lens,
    }),
    inputSnapshot,
    rankingSnapshot,
    ruleSnapshot,
  };
}

export const recommend = recommendCardForPurchase;

function normalizeRecommendationInput(
  input: RecommendationInput,
): NormalizedRecommendationInput {
  const purchaseAmountCents = input.purchaseAmountCents ?? 10000;
  if (!Number.isInteger(purchaseAmountCents) || purchaseAmountCents <= 0) {
    throw new InvalidPurchaseAmountError(purchaseAmountCents);
  }

  return {
    userId: input.userId,
    merchantId: input.merchantId,
    merchantUrl: input.merchantUrl,
    merchantName: input.merchantName,
    purchaseAmountCents,
    timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
    lens: input.lens ?? "PRACTICAL",
    context: input.context ?? "MANUAL_LOOKUP",
    categoryOverride: input.categoryOverride,
    categoryOverrideReason: input.categoryOverrideReason,
    ignoreUserPreferences: input.ignoreUserPreferences ?? false,
  };
}

function scoreUserCard(options: {
  userCard: EngineUserCard;
  match: RuleMatch;
  valuation: EngineCurrencyValuation;
  normalizedInput: NormalizedRecommendationInput;
  merchantName: string;
  expectedCategory: MerchantCategory;
  merchantConfidence: ConfidenceLevel;
  customNotes: string[];
  offers: EngineIssuerOffer[];
  valuations: EngineCurrencyValuation[];
}): RecommendedCardResult {
  const primary = computeExpectedValueCents(
    options.match.effectiveAmountCents,
    options.match.rule.multiplier,
    options.valuation.centsPerPoint,
  );
  const fallback =
    options.match.fallbackRule && options.match.fallbackAmountCents > 0
      ? computeExpectedValueCents(
          options.match.fallbackAmountCents,
          options.match.fallbackRule.multiplier,
          options.valuation.centsPerPoint,
        )
      : { points: 0, valueCents: 0 };
  const offerApplication = computeOfferApplication({
    userCard: options.userCard,
    offers: options.offers,
    valuations: options.valuations,
    amountCents: options.normalizedInput.purchaseAmountCents,
  });
  const expectedValueCents =
    primary.valueCents + fallback.valueCents + offerApplication.valueCents;
  const expectedPoints = primary.points + fallback.points;
  const confidence = combineConfidence([
    options.match.confidence,
    options.valuation.confidence,
    options.merchantConfidence,
    ...offerApplication.materialConfidences,
  ]);
  const warnings = [
    ...options.match.warnings,
    ...(options.match.rule.confidence !== "HIGH"
      ? ["This recommendation uses a low-confidence or medium-confidence rule."]
      : []),
    ...(options.valuation.confidence !== "HIGH"
      ? ["Currency valuation confidence is not HIGH."]
      : []),
    ...offerApplication.warnings,
    ...options.customNotes.map((note) => `User note: ${note}`),
  ];
  const effectiveMultiplier = decimalToNumber(options.match.rule.multiplier);

  const explanationParts = buildCardExplanationParts({
    cardName: options.userCard.card.name,
    merchantName: options.merchantName,
    category: options.expectedCategory,
    multiplier: effectiveMultiplier,
    rewardCurrencyCode: options.match.rule.rewardCurrency.code,
    lens: options.normalizedInput.lens,
    expectedValueCents,
    confidence,
    warnings,
  });
  if (offerApplication.applied.length > 0) {
    explanationParts.push(
      `Includes ${formatOfferValue(offerApplication.valueCents)} from activated offer${offerApplication.applied.length === 1 ? "" : "s"}.`,
    );
  }

  return {
    rank: 0,
    userCardId: options.userCard.id,
    cardId: options.userCard.cardId,
    cardName: options.userCard.card.name,
    issuerName: options.userCard.card.issuer.name,
    rewardCurrencyCode: options.match.rule.rewardCurrency.code,
    matchedRuleId: options.match.rule.id,
    matchedRuleDescription: options.match.rule.notes ?? undefined,
    effectiveMultiplier,
    expectedPoints,
    expectedValueCents,
    confidence,
    explanationParts,
    warnings,
    appliedOfferIds: offerApplication.applied.map((offer) => offer.offerId),
    availableButNotActivatedOfferIds: offerApplication.available.map(
      (offer) => offer.offerId,
    ),
    offerValueCents: offerApplication.valueCents,
  };
}

function findValuation(
  valuations: EngineCurrencyValuation[],
  currencyId: string,
): EngineCurrencyValuation | undefined {
  return valuations
    .filter((valuation) => valuation.currencyId === currencyId)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}

function computeOfferApplication(options: {
  userCard: EngineUserCard;
  offers: EngineIssuerOffer[];
  valuations: EngineCurrencyValuation[];
  amountCents: number;
}): {
  valueCents: number;
  applied: Array<{ offerId: string }>;
  available: Array<{ offerId: string }>;
  warnings: string[];
  materialConfidences: ConfidenceLevel[];
} {
  let valueCents = 0;
  const applied: Array<{ offerId: string }> = [];
  const available: Array<{ offerId: string }> = [];
  const warnings: string[] = [];
  const materialConfidences: ConfidenceLevel[] = [];

  for (const offer of options.offers) {
    if (!isOfferApplicableToCard(offer, options.userCard)) {
      continue;
    }
    if (offer.userStatus === "DISMISSED" || offer.userStatus === "EXPIRED") {
      continue;
    }
    if (offer.userStatus === "USED") {
      continue;
    }
    if (
      offer.minSpendCents !== null &&
      offer.minSpendCents !== undefined &&
      options.amountCents < offer.minSpendCents
    ) {
      continue;
    }

    const activationSatisfied =
      !offer.activationRequired || offer.userStatus === "ACTIVATED";
    if (!activationSatisfied) {
      if (offer.userStatus === "AVAILABLE") {
        available.push({ offerId: offer.id });
        warnings.push(
          `${offer.title} may be available, but it must be activated before purchase.`,
        );
      }
      continue;
    }

    const offerValue = computeOfferValueCents(offer, options);
    if (offerValue <= 0) {
      continue;
    }

    valueCents += offerValue;
    applied.push({ offerId: offer.id });
    materialConfidences.push(offer.confidence);
  }

  return {
    valueCents,
    applied,
    available,
    warnings,
    materialConfidences,
  };
}

function computeOfferValueCents(
  offer: EngineIssuerOffer,
  options: {
    amountCents: number;
    valuations: EngineCurrencyValuation[];
  },
): number {
  const valueCents = (() => {
    if (
      offer.offerType === "STATEMENT_CREDIT" ||
      offer.offerType === "DISCOUNT"
    ) {
      return Math.min(offer.valueCents ?? 0, options.amountCents);
    }
    if (offer.offerType === "BONUS_POINTS") {
      const valuation = findOfferValuation(offer, options.valuations);
      return valuation && offer.bonusPoints
        ? roundValueCents(
            computeValueCents(offer.bonusPoints, valuation.centsPerPoint),
          )
        : 0;
    }
    if (offer.offerType === "BONUS_MULTIPLIER") {
      const valuation = findOfferValuation(offer, options.valuations);
      return valuation && offer.bonusMultiplier
        ? computeExpectedValueCents(
            options.amountCents,
            offer.bonusMultiplier,
            valuation.centsPerPoint,
          ).valueCents
        : 0;
    }
    return Math.min(offer.valueCents ?? 0, options.amountCents);
  })();

  return Math.max(
    0,
    Math.min(valueCents, offer.maxRewardCents ?? Number.POSITIVE_INFINITY),
  );
}

function findOfferValuation(
  offer: EngineIssuerOffer,
  valuations: EngineCurrencyValuation[],
): EngineCurrencyValuation | undefined {
  const currencyId = offer.bonusCurrency?.id ?? offer.bonusCurrencyId;
  return currencyId ? findValuation(valuations, currencyId) : undefined;
}

function isOfferApplicableToCard(
  offer: EngineIssuerOffer,
  userCard: EngineUserCard,
): boolean {
  const userCardMatches = !offer.userCardId || offer.userCardId === userCard.id;
  const cardMatches = !offer.cardId || offer.cardId === userCard.cardId;
  const issuerMatches =
    !offer.issuerId || offer.issuerId === userCard.card.issuer.id;
  return userCardMatches && cardMatches && issuerMatches;
}

function formatOfferValue(valueCents: number): string {
  return `$${(valueCents / 100).toFixed(2)}`;
}
