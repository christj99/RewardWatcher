import type {
  RewardsEngineRepository,
  EngineCapLedger,
  EngineCurrencyValuation,
  EngineEarningRule,
  EngineIssuerOffer,
  EngineMerchant,
  EngineMerchantPostingProfile,
  EngineUserCard,
  EngineUserPreferenceRule,
  Lens,
  MerchantCategory,
} from "@rewards-audit/rewards-engine";
import { prisma } from "@rewards-audit/db";

import { resolveMerchantByUrl } from "../services/merchantService.js";

export class PrismaRewardsEngineRepository implements RewardsEngineRepository {
  async getUserWallet(userId: string): Promise<EngineUserCard[]> {
    const userCards = await prisma.userCard.findMany({
      where: { userId, isActive: true },
      include: {
        card: {
          include: {
            issuer: true,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return userCards.map((userCard) => ({
      id: userCard.id,
      userId: userCard.userId,
      cardId: userCard.cardId,
      isActive: userCard.isActive,
      nickname: userCard.nickname,
      card: {
        id: userCard.card.id,
        name: userCard.card.name,
        slug: userCard.card.slug,
        issuer: {
          id: userCard.card.issuer.id,
          name: userCard.card.issuer.name,
          slug: userCard.card.issuer.slug,
        },
        network: userCard.card.network,
        annualFeeCents: userCard.card.annualFeeCents,
        isActive: userCard.card.isActive,
      },
    }));
  }

  async findMerchantById(merchantId: string): Promise<EngineMerchant | null> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    return merchant
      ? {
          id: merchant.id,
          name: merchant.name,
          category: merchant.category,
        }
      : null;
  }

  async findMerchantByUrl(url: string): Promise<EngineMerchant | null> {
    try {
      const resolution = await resolveMerchantByUrl(url);
      return {
        id: resolution.merchant.id,
        name: resolution.merchant.name,
        category: resolution.merchant.category,
      };
    } catch {
      return null;
    }
  }

  async findMerchantByName(name: string): Promise<EngineMerchant | null> {
    const merchant = await prisma.merchant.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: "insensitive" } },
          { name: { contains: name, mode: "insensitive" } },
          { slug: { contains: name, mode: "insensitive" } },
        ],
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    return merchant
      ? {
          id: merchant.id,
          name: merchant.name,
          category: merchant.category,
        }
      : null;
  }

  async getMerchantPostingProfiles(
    merchantId: string,
  ): Promise<EngineMerchantPostingProfile[]> {
    const profiles = await prisma.merchantPostingProfile.findMany({
      where: { merchantId },
      orderBy: [
        { confidence: "asc" },
        { observationCount: "desc" },
        { id: "asc" },
      ],
    });

    return profiles.map((profile) => ({
      id: profile.id,
      merchantId: profile.merchantId,
      observedCategory: profile.observedCategory,
      confidence: profile.confidence,
      observationCount: profile.observationCount,
      notes: profile.notes,
    }));
  }

  async getEarningRulesForCards(
    cardIds: string[],
    timestamp: Date,
  ): Promise<EngineEarningRule[]> {
    const rules = await prisma.earningRule.findMany({
      where: {
        cardId: { in: cardIds },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: timestamp } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: timestamp } }] },
        ],
      },
      include: {
        rewardCurrency: true,
      },
      orderBy: [{ cardId: "asc" }, { id: "asc" }],
    });

    return rules.map((rule) => ({
      id: rule.id,
      cardId: rule.cardId,
      cardVersionId: rule.cardVersionId,
      rewardCurrencyId: rule.rewardCurrencyId,
      rewardCurrency: {
        id: rule.rewardCurrency.id,
        code: rule.rewardCurrency.code,
        name: rule.rewardCurrency.name,
        currencyType: rule.rewardCurrency.currencyType,
      },
      category: rule.category,
      merchantId: rule.merchantId,
      multiplier: rule.multiplier,
      baseRateMultiplier: rule.baseRateMultiplier,
      capAmountCents: rule.capAmountCents,
      capPeriod: rule.capPeriod,
      activationRequired: rule.activationRequired,
      startsAt: rule.startsAt,
      endsAt: rule.endsAt,
      confidence: rule.confidence,
      sourceId: rule.sourceId,
      notes: rule.notes,
    }));
  }

  async getCurrencyValuations(
    currencyIds: string[],
    lens: Lens,
    timestamp: Date,
  ): Promise<EngineCurrencyValuation[]> {
    const valuations = await prisma.currencyValuation.findMany({
      where: {
        currencyId: { in: currencyIds },
        lens,
        AND: [
          { effectiveFrom: { lte: timestamp } },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: timestamp } }] },
        ],
      },
      orderBy: [
        { currencyId: "asc" },
        { effectiveFrom: "desc" },
        { confidence: "asc" },
        { id: "asc" },
      ],
    });

    const byCurrency = new Map<string, EngineCurrencyValuation>();
    for (const valuation of valuations) {
      if (byCurrency.has(valuation.currencyId)) {
        continue;
      }

      byCurrency.set(valuation.currencyId, {
        id: valuation.id,
        currencyId: valuation.currencyId,
        lens: valuation.lens,
        centsPerPoint: valuation.centsPerPoint,
        confidence: valuation.confidence,
        effectiveFrom: valuation.effectiveFrom,
        effectiveTo: valuation.effectiveTo,
      });
    }

    return [...byCurrency.values()];
  }

  async getCapLedgers(
    userId: string,
    userCardIds: string[],
    timestamp: Date,
  ): Promise<EngineCapLedger[]> {
    const ledgers = await prisma.capLedger.findMany({
      where: {
        userId,
        userCardId: { in: userCardIds },
        periodStart: { lte: timestamp },
        periodEnd: { gte: timestamp },
      },
      orderBy: [{ periodStart: "desc" }, { id: "asc" }],
    });

    return ledgers.map((ledger) => ({
      id: ledger.id,
      userId: ledger.userId,
      userCardId: ledger.userCardId,
      earningRuleId: ledger.earningRuleId,
      periodStart: ledger.periodStart,
      periodEnd: ledger.periodEnd,
      usedAmountCents: ledger.usedAmountCents,
    }));
  }

  async getUserPreferenceRules(
    userId: string,
    merchantId: string | undefined,
    category: MerchantCategory,
  ): Promise<EngineUserPreferenceRule[]> {
    const merchantConditions = merchantId
      ? [{ merchantId: null }, { merchantId }]
      : [{ merchantId: null }];
    const rules = await prisma.userPreferenceRule.findMany({
      where: {
        userId,
        AND: [
          { OR: merchantConditions },
          { OR: [{ category: null }, { category }] },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return rules.map((rule) => ({
      id: rule.id,
      userId: rule.userId,
      cardId: rule.cardId,
      merchantId: rule.merchantId,
      category: rule.category,
      preferenceType: rule.preferenceType,
      reason: rule.reason,
    }));
  }

  async getActiveOffersForUser(
    userId: string,
    userCardIds: string[],
    merchantId: string | undefined,
    category: MerchantCategory,
    timestamp: Date,
  ): Promise<EngineIssuerOffer[]> {
    if (userCardIds.length === 0) {
      return [];
    }

    const wallet = await prisma.userCard.findMany({
      where: { userId, id: { in: userCardIds }, isActive: true },
      include: { card: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const cardIds = wallet.map((userCard) => userCard.cardId);
    const issuerIds = [
      ...new Set(wallet.map((userCard) => userCard.card.issuerId)),
    ];

    const offers = await prisma.issuerOffer.findMany({
      where: {
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: timestamp } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: timestamp } }] },
          {
            OR: [
              { cardId: { in: cardIds } },
              { issuerId: { in: issuerIds } },
              ...(merchantId ? [{ merchantId }] : []),
              { category },
            ],
          },
          {
            OR: [{ merchantId: null }, ...(merchantId ? [{ merchantId }] : [])],
          },
          { OR: [{ category: null }, { category }] },
        ],
      },
      include: {
        bonusCurrency: true,
        userActivations: {
          where: {
            userId,
            OR: [{ userCardId: null }, { userCardId: { in: userCardIds } }],
          },
        },
      },
      orderBy: [{ endsAt: "asc" }, { title: "asc" }, { id: "asc" }],
    });

    const result: EngineIssuerOffer[] = [];
    for (const offer of offers) {
      const matchingWallet = wallet.filter((userCard) => {
        const cardMatches = !offer.cardId || offer.cardId === userCard.cardId;
        const issuerMatches =
          !offer.issuerId || offer.issuerId === userCard.card.issuerId;
        return cardMatches && issuerMatches;
      });

      for (const userCard of matchingWallet) {
        const activation =
          offer.userActivations.find(
            (candidate) => candidate.userCardId === userCard.id,
          ) ??
          offer.userActivations.find(
            (candidate) => candidate.userCardId === null,
          );
        result.push({
          id: offer.id,
          issuerId: offer.issuerId,
          cardId: offer.cardId,
          merchantId: offer.merchantId,
          category: offer.category,
          title: offer.title,
          description: offer.description,
          offerType: offer.offerType,
          valueCents: offer.valueCents,
          bonusPoints: offer.bonusPoints,
          bonusCurrencyId: offer.bonusCurrencyId,
          bonusCurrency: offer.bonusCurrency
            ? {
                id: offer.bonusCurrency.id,
                code: offer.bonusCurrency.code,
                name: offer.bonusCurrency.name,
                currencyType: offer.bonusCurrency.currencyType,
              }
            : null,
          bonusMultiplier: offer.bonusMultiplier,
          minSpendCents: offer.minSpendCents,
          maxRewardCents: offer.maxRewardCents,
          activationRequired: offer.activationRequired,
          startsAt: offer.startsAt,
          endsAt: offer.endsAt,
          confidence: offer.confidence,
          sourceId: offer.sourceId,
          notes: offer.notes,
          userCardId: userCard.id,
          userStatus: activation?.status ?? "AVAILABLE",
        });
      }
    }

    return result;
  }
}
