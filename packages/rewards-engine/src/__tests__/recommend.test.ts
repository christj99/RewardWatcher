import { describe, expect, it } from "vitest";

import {
  baseRule,
  currencies,
  defaultEarningRules,
  earningRule,
  InMemoryRewardsEngineRepository,
  userCard,
  valuation,
} from "../fixtures.js";
import { recommendCardForPurchase } from "../recommend.js";
import {
  InvalidPurchaseAmountError,
  UserHasNoActiveCardsError,
} from "../errors.js";

const timestamp = "2026-02-15T00:00:00.000Z";

describe("recommendCardForPurchase", () => {
  it("recommends Amex Gold for a dining merchant from seeded-like fixtures", async () => {
    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 5000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository(),
    );

    expect(result.primaryRecommendation.cardId).toBe("card-amex-gold");
    expect(result.primaryRecommendation.expectedValueCents).toBe(320);
    expect(result.explanation).toContain("American Express Gold Card");
  });

  it("recommends Amex Gold for grocery under the fixture valuations", async () => {
    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-grocery",
        purchaseAmountCents: 10000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository(),
    );

    expect(result.primaryRecommendation.cardId).toBe("card-amex-gold");
    expect(result.primaryRecommendation.expectedValueCents).toBe(640);
  });

  it("recommends highest base earn card for a general merchant", async () => {
    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-general",
        purchaseAmountCents: 10000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository(),
    );

    expect(result.primaryRecommendation.cardId).toBe("card-venture-x");
    expect(result.primaryRecommendation.rewardCurrencyCode).toBe(
      "CAPITAL_ONE_MILES",
    );
  });

  it("cap exhaustion changes the winner", async () => {
    const wallet = [
      userCard("uc-capped", "card-capped", "Capped Dining Card", "Test Bank"),
      userCard("uc-steady", "card-steady", "Steady Dining Card", "Test Bank"),
    ];
    const repository = new InMemoryRewardsEngineRepository({
      wallet,
      earningRules: [
        {
          ...earningRule(
            "rule-capped-dining",
            "card-capped",
            currencies.cash,
            "DINING",
            "10",
          ),
          capAmountCents: 5000,
          capPeriod: "QUARTERLY",
        },
        baseRule("rule-capped-base", "card-capped", currencies.cash, "1"),
        earningRule(
          "rule-steady-dining",
          "card-steady",
          currencies.cash,
          "DINING",
          "3",
        ),
      ],
      capLedgers: [
        {
          id: "ledger-capped",
          userId: "user-1",
          userCardId: "uc-capped",
          earningRuleId: "rule-capped-dining",
          periodStart: "2026-01-01T00:00:00.000Z",
          periodEnd: "2026-03-31T23:59:59.000Z",
          usedAmountCents: 5000,
        },
      ],
    });

    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 10000,
        timestamp,
      },
      repository,
    );

    expect(result.primaryRecommendation.cardId).toBe("card-steady");
    expect(result.warnings.join(" ")).toContain("exhausted");
  });

  it("AVOID_CARD excludes a card and warns", async () => {
    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 5000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository({
        preferences: [
          {
            id: "pref-avoid-amex",
            userId: "user-1",
            cardId: "card-amex-gold",
            merchantId: "merchant-dining",
            preferenceType: "AVOID_CARD",
          },
        ],
      }),
    );

    expect(result.primaryRecommendation.cardId).toBe("card-csp");
    expect(result.warnings.join(" ")).toContain("excluded");
  });

  it("PREFER_CARD breaks ties only", async () => {
    const wallet = [
      userCard("uc-a", "card-a", "Alpha Card", "Test Bank"),
      userCard("uc-b", "card-b", "Beta Card", "Test Bank"),
    ];
    const repository = new InMemoryRewardsEngineRepository({
      wallet,
      earningRules: [
        earningRule("rule-a", "card-a", currencies.cash, "DINING", "2"),
        earningRule("rule-b", "card-b", currencies.cash, "DINING", "2"),
      ],
      preferences: [
        {
          id: "pref-b",
          userId: "user-1",
          cardId: "card-b",
          preferenceType: "PREFER_CARD",
        },
      ],
    });

    const result = await recommendCardForPurchase(
      { userId: "user-1", merchantId: "merchant-dining", timestamp },
      repository,
    );

    expect(result.primaryRecommendation.cardId).toBe("card-b");
  });

  it("does not let PREFER_CARD override clearly worse economics", async () => {
    const repository = new InMemoryRewardsEngineRepository({
      preferences: [
        {
          id: "pref-csp",
          userId: "user-1",
          cardId: "card-csp",
          preferenceType: "PREFER_CARD",
        },
      ],
    });

    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 5000,
        timestamp,
      },
      repository,
    );

    expect(result.primaryRecommendation.cardId).toBe("card-amex-gold");
  });

  it("produces deterministic ranking for the same input", async () => {
    const repository = new InMemoryRewardsEngineRepository();
    const input = {
      userId: "user-1",
      merchantId: "merchant-dining",
      purchaseAmountCents: 5000,
      timestamp,
    };

    const first = await recommendCardForPurchase(input, repository);
    const second = await recommendCardForPurchase(input, repository);

    expect(first.rankingSnapshot).toEqual(second.rankingSnapshot);
  });

  it("includes snapshots and alternatives", async () => {
    const result = await recommendCardForPurchase(
      { userId: "user-1", merchantUrl: "target.com", timestamp },
      new InMemoryRewardsEngineRepository(),
    );

    expect(result.inputSnapshot).toHaveProperty("resolvedMerchant");
    expect(result.rankingSnapshot).toHaveProperty("rankedCards");
    expect(result.ruleSnapshot).toHaveProperty("matchedEarningRuleIds");
    expect(result.primaryRecommendation).toBeDefined();
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it("uses defaults for amount, lens, and context", async () => {
    const result = await recommendCardForPurchase(
      { userId: "user-1", merchantId: "merchant-general", timestamp },
      new InMemoryRewardsEngineRepository(),
    );

    expect(result.input.purchaseAmountCents).toBe(10000);
    expect(result.input.lens).toBe("PRACTICAL");
    expect(result.input.context).toBe("MANUAL_LOOKUP");
  });

  it("throws a clear error when user has no active cards", async () => {
    await expect(
      recommendCardForPurchase(
        { userId: "user-1", merchantId: "merchant-dining", timestamp },
        new InMemoryRewardsEngineRepository({ wallet: [] }),
      ),
    ).rejects.toBeInstanceOf(UserHasNoActiveCardsError);
  });

  it("throws a clear error for invalid negative purchase amount", async () => {
    await expect(
      recommendCardForPurchase(
        {
          userId: "user-1",
          merchantId: "merchant-dining",
          purchaseAmountCents: -1,
          timestamp,
        },
        new InMemoryRewardsEngineRepository(),
      ),
    ).rejects.toBeInstanceOf(InvalidPurchaseAmountError);
  });

  it("handles activation warnings in full recommendation results", async () => {
    const result = await recommendCardForPurchase(
      { userId: "user-1", merchantId: "merchant-online", timestamp },
      new InMemoryRewardsEngineRepository({
        earningRules: [
          ...defaultEarningRules,
          {
            ...earningRule(
              "rule-venture-online-activation",
              "card-venture-x",
              currencies.capitalOne,
              "ONLINE_RETAIL",
              "5",
              "HIGH",
            ),
            activationRequired: true,
          },
        ],
      }),
    );

    expect(result.primaryRecommendation.matchedRuleId).toBe(
      "rule-venture-online-activation",
    );
    expect(result.primaryRecommendation.confidence).toBe("MEDIUM");
    expect(result.primaryRecommendation.warnings.join(" ")).toContain(
      "activation",
    );
  });

  it("uses valuation confidence as part of result confidence", async () => {
    const result = await recommendCardForPurchase(
      { userId: "user-1", merchantId: "merchant-dining", timestamp },
      new InMemoryRewardsEngineRepository({
        valuations: [
          valuation(
            "val-amex-low",
            currencies.amexMr.id,
            "PRACTICAL",
            "1.6",
            "LOW",
          ),
          valuation(
            "val-chase",
            currencies.chaseUr.id,
            "PRACTICAL",
            "1.7",
            "MEDIUM",
          ),
          valuation("val-cash", currencies.cash.id, "PRACTICAL", "1", "HIGH"),
          valuation(
            "val-capital-one",
            currencies.capitalOne.id,
            "PRACTICAL",
            "1.4",
            "MEDIUM",
          ),
        ],
      }),
    );

    expect(result.primaryRecommendation.cardId).toBe("card-amex-gold");
    expect(result.primaryRecommendation.confidence).toBe("LOW");
  });

  it("counts activated statement credit offers and snapshots offer ids", async () => {
    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 5000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository({
        offers: [
          {
            id: "offer-csp-dining-credit",
            cardId: "card-csp",
            merchantId: "merchant-dining",
            title: "CSP dining credit",
            description: "Test offer",
            offerType: "STATEMENT_CREDIT",
            valueCents: 500,
            activationRequired: true,
            confidence: "HIGH",
            userCardId: "uc-csp",
            userStatus: "ACTIVATED",
          },
        ],
      }),
    );

    expect(result.primaryRecommendation.cardId).toBe("card-csp");
    expect(result.primaryRecommendation.expectedValueCents).toBe(755);
    expect(result.primaryRecommendation.appliedOfferIds).toEqual([
      "offer-csp-dining-credit",
    ]);
    expect(result.ruleSnapshot).toMatchObject({
      appliedOfferIds: ["offer-csp-dining-credit"],
    });
  });

  it("warns on available unactivated offers without counting their value", async () => {
    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 5000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository({
        offers: [
          {
            id: "offer-csp-available",
            cardId: "card-csp",
            merchantId: "merchant-dining",
            title: "CSP available dining credit",
            description: "Test offer",
            offerType: "STATEMENT_CREDIT",
            valueCents: 500,
            activationRequired: true,
            confidence: "HIGH",
            userCardId: "uc-csp",
            userStatus: "AVAILABLE",
          },
        ],
      }),
    );

    expect(result.primaryRecommendation.cardId).toBe("card-amex-gold");
    expect(result.ruleSnapshot).toMatchObject({
      availableButNotActivatedOfferIds: ["offer-csp-available"],
    });
    expect(result.warnings.join(" ")).toContain("must be activated");
  });

  it("ignores dismissed and expired offers", async () => {
    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 5000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository({
        offers: [
          {
            id: "offer-dismissed",
            cardId: "card-csp",
            merchantId: "merchant-dining",
            title: "Dismissed offer",
            description: "Test offer",
            offerType: "STATEMENT_CREDIT",
            valueCents: 5000,
            activationRequired: true,
            confidence: "HIGH",
            userCardId: "uc-csp",
            userStatus: "DISMISSED",
          },
          {
            id: "offer-expired",
            cardId: "card-csp",
            merchantId: "merchant-dining",
            title: "Expired offer",
            description: "Test offer",
            offerType: "STATEMENT_CREDIT",
            valueCents: 5000,
            activationRequired: true,
            confidence: "HIGH",
            userCardId: "uc-csp",
            userStatus: "EXPIRED",
          },
        ],
      }),
    );

    expect(result.primaryRecommendation.cardId).toBe("card-amex-gold");
    expect(result.ruleSnapshot).toMatchObject({ appliedOfferIds: [] });
  });

  it("respects offer minimum spend and max reward", async () => {
    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 5000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository({
        offers: [
          {
            id: "offer-min-not-met",
            cardId: "card-csp",
            merchantId: "merchant-dining",
            title: "Minimum spend not met",
            description: "Test offer",
            offerType: "STATEMENT_CREDIT",
            valueCents: 5000,
            minSpendCents: 10000,
            activationRequired: true,
            confidence: "HIGH",
            userCardId: "uc-csp",
            userStatus: "ACTIVATED",
          },
          {
            id: "offer-capped",
            cardId: "card-csp",
            merchantId: "merchant-dining",
            title: "Capped offer",
            description: "Test offer",
            offerType: "STATEMENT_CREDIT",
            valueCents: 5000,
            maxRewardCents: 300,
            activationRequired: true,
            confidence: "HIGH",
            userCardId: "uc-csp",
            userStatus: "ACTIVATED",
          },
        ],
      }),
    );

    expect(result.primaryRecommendation.cardId).toBe("card-csp");
    expect(result.primaryRecommendation.offerValueCents).toBe(300);
  });

  it("values bonus points and bonus multiplier offers", async () => {
    const bonusPoints = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 5000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository({
        offers: [
          {
            id: "offer-csp-points",
            cardId: "card-csp",
            merchantId: "merchant-dining",
            title: "CSP points",
            description: "Test offer",
            offerType: "BONUS_POINTS",
            bonusPoints: 1000,
            bonusCurrency: currencies.chaseUr,
            activationRequired: true,
            confidence: "HIGH",
            userCardId: "uc-csp",
            userStatus: "ACTIVATED",
          },
        ],
      }),
    );
    const multiplier = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 10000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository({
        offers: [
          {
            id: "offer-csp-multiplier",
            cardId: "card-csp",
            merchantId: "merchant-dining",
            title: "CSP multiplier",
            description: "Test offer",
            offerType: "BONUS_MULTIPLIER",
            bonusMultiplier: "2",
            bonusCurrency: currencies.chaseUr,
            activationRequired: true,
            confidence: "HIGH",
            userCardId: "uc-csp",
            userStatus: "ACTIVATED",
          },
        ],
      }),
    );

    expect(bonusPoints.primaryRecommendation.offerValueCents).toBe(1700);
    expect(multiplier.primaryRecommendation.offerValueCents).toBe(340);
  });

  it("low-confidence material offers downgrade confidence", async () => {
    const result = await recommendCardForPurchase(
      {
        userId: "user-1",
        merchantId: "merchant-dining",
        purchaseAmountCents: 5000,
        timestamp,
      },
      new InMemoryRewardsEngineRepository({
        offers: [
          {
            id: "offer-low-confidence",
            cardId: "card-csp",
            merchantId: "merchant-dining",
            title: "Low confidence dining credit",
            description: "Test offer",
            offerType: "STATEMENT_CREDIT",
            valueCents: 1000,
            activationRequired: true,
            confidence: "LOW",
            userCardId: "uc-csp",
            userStatus: "ACTIVATED",
          },
        ],
      }),
    );

    expect(result.primaryRecommendation.cardId).toBe("card-csp");
    expect(result.primaryRecommendation.confidence).toBe("LOW");
  });
});
