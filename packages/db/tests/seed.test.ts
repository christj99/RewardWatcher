import { CurrencyType, Lens } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "../src/client.js";
import { seedDatabase } from "../src/seed.js";

const expectedIssuers = ["chase", "american-express", "capital-one"];
const expectedCards = [
  "chase-sapphire-preferred",
  "chase-freedom-flex",
  "chase-freedom-unlimited",
  "amex-gold",
  "amex-blue-cash-preferred",
  "capital-one-venture-x",
];
const expectedCurrencies = [
  "USD_CASHBACK",
  "CHASE_UR",
  "AMEX_MR",
  "CAPITAL_ONE_MILES",
];

describe("Phase 1 seed data", () => {
  beforeAll(async () => {
    await seedDatabase();
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("can run the seed twice without duplicating unique seed records", async () => {
    const before = await uniqueSeedCounts();

    await seedDatabase();

    await expect(uniqueSeedCounts()).resolves.toEqual(before);
  }, 30_000);

  it("has a generated Prisma client with Phase 1 models", () => {
    expect(prisma.recommendationEvent).toBeDefined();
    expect(prisma.recommendationOutcome).toBeDefined();
    expect(prisma.merchantPostingProfile).toBeDefined();
  });

  it("seeds beta and admin users", async () => {
    const [beta, admin] = await Promise.all([
      prisma.user.findUnique({ where: { email: "beta@example.com" } }),
      prisma.user.findUnique({ where: { email: "admin@example.com" } }),
    ]);

    expect(beta?.displayName).toBe("Beta User");
    expect(beta?.plaidBetaEnabled).toBe(true);
    expect(admin?.displayName).toBe("Admin User");
    expect(admin?.isAdmin).toBe(true);
  });

  it("seeds issuers and cards with issuer relationships", async () => {
    const issuers = await prisma.issuer.findMany({
      where: { slug: { in: expectedIssuers } },
      include: { cards: true },
    });
    const cards = await prisma.card.findMany({
      where: { slug: { in: expectedCards } },
      include: { issuer: true, versions: true },
    });

    expect(issuers).toHaveLength(expectedIssuers.length);
    expect(cards).toHaveLength(expectedCards.length);
    expect(
      cards.every((card) => card.issuer && card.versions.length === 1),
    ).toBe(true);
  });

  it("seeds currencies and valuations for each lens", async () => {
    const currencies = await prisma.currency.findMany({
      where: { code: { in: expectedCurrencies } },
      include: { valuations: true },
    });

    expect(currencies).toHaveLength(expectedCurrencies.length);
    expect(
      currencies.find((currency) => currency.code === "USD_CASHBACK")
        ?.currencyType,
    ).toBe(CurrencyType.CASHBACK);

    const pointsCurrencies = currencies.filter(
      (currency) => currency.currencyType !== CurrencyType.CASHBACK,
    );

    for (const currency of pointsCurrencies) {
      expect(
        currency.valuations.map((valuation) => valuation.lens).sort(),
      ).toEqual([Lens.ASPIRATIONAL, Lens.CASH_OUT, Lens.PRACTICAL].sort());
    }
  });

  it("seeds earning rules with card, reward currency, confidence, and source", async () => {
    const earningRules = await prisma.earningRule.findMany({
      where: { id: { startsWith: "seed-earning-rule-" } },
      include: { card: true, rewardCurrency: true, source: true },
    });

    expect(earningRules.length).toBeGreaterThanOrEqual(20);
    expect(
      earningRules.every(
        (rule) =>
          rule.card &&
          rule.rewardCurrency &&
          rule.confidence &&
          rule.source &&
          rule.multiplier.toNumber() > 0,
      ),
    ).toBe(true);
  });

  it("seeds the beta user wallet and cap ledger fixture", async () => {
    const beta = await prisma.user.findUniqueOrThrow({
      where: { email: "beta@example.com" },
      include: {
        userCards: {
          include: { card: true, capLedgers: true },
        },
      },
    });

    const walletSlugs = beta.userCards.map((userCard) => userCard.card.slug);
    expect(walletSlugs).toEqual(
      expect.arrayContaining(expectedCards.slice(0, 4)),
    );
    expect(walletSlugs).toContain("chase-freedom-flex");
    expect(
      beta.userCards.some((userCard) => userCard.capLedgers.length > 0),
    ).toBe(true);
  });

  it("seeds merchants, URL patterns, and posting profiles", async () => {
    const merchants = await prisma.merchant.findMany({
      include: {
        urlPatterns: true,
        postingProfiles: true,
      },
    });
    const wholeFoods = merchants.find(
      (merchant) => merchant.slug === "whole-foods",
    );

    expect(merchants.length).toBeGreaterThanOrEqual(10);
    expect(merchants.flatMap((merchant) => merchant.urlPatterns).length).toBe(
      9,
    );
    expect(wholeFoods?.postingProfiles[0]?.merchantId).toBe(wholeFoods?.id);
  });

  it("queries the seeded recommendation event with user, merchant, card, and snapshots", async () => {
    const recommendation = await prisma.recommendationEvent.findUniqueOrThrow({
      where: { id: "seed-recommendation-local-restaurant-2026-02-15" },
      include: {
        user: true,
        merchant: true,
        recommendedCard: true,
        recommendedUserCard: true,
      },
    });

    expect(recommendation.user.email).toBe("beta@example.com");
    expect(recommendation.merchant?.slug).toBe(
      "local-restaurant-test-merchant",
    );
    expect(recommendation.recommendedCard.slug).toBe("amex-gold");
    expect(recommendation.recommendedUserCard).not.toBeNull();
    expect(recommendation.inputSnapshot).toMatchObject({ amountCents: 5000 });
    expect(recommendation.rankingSnapshot).toHaveProperty("rankedCards");
    expect(recommendation.ruleSnapshot).toMatchObject({ multiplier: "4" });
  });

  it("queries the seeded transaction with user, merchant, and user card", async () => {
    const transaction = await prisma.transaction.findUniqueOrThrow({
      where: { id: "seed-transaction-local-restaurant-2026-02-15" },
      include: {
        user: true,
        merchant: true,
        userCard: { include: { card: true } },
      },
    });

    expect(transaction.user.email).toBe("beta@example.com");
    expect(transaction.merchant?.slug).toBe("local-restaurant-test-merchant");
    expect(transaction.userCard?.card.slug).toBe("chase-freedom-unlimited");
  });

  it("links recommendation outcome to transaction and recommendation event", async () => {
    const outcome = await prisma.recommendationOutcome.findUniqueOrThrow({
      where: { id: "seed-outcome-local-restaurant-2026-02-15" },
      include: {
        transaction: true,
        recommendationEvent: true,
        actualUserCard: true,
        bestUserCard: true,
        recommendedUserCard: true,
      },
    });

    expect(outcome.transaction.id).toBe(
      "seed-transaction-local-restaurant-2026-02-15",
    );
    expect(outcome.recommendationEvent?.id).toBe(
      "seed-recommendation-local-restaurant-2026-02-15",
    );
    expect(outcome.actualUserCard).not.toBeNull();
    expect(outcome.bestUserCard?.id).toBe(outcome.recommendedUserCard?.id);
  });

  it("links recommendation correction and curator review task", async () => {
    const correction = await prisma.recommendationCorrection.findUniqueOrThrow({
      where: { id: "seed-correction-local-restaurant-category" },
      include: {
        recommendationEvent: true,
        reviewTasks: true,
      },
    });

    expect(correction.recommendationEvent?.id).toBe(
      "seed-recommendation-local-restaurant-2026-02-15",
    );
    expect(correction.reviewTasks[0]?.correctionId).toBe(correction.id);
  });

  it("seeds issuer offers and beta activation states", async () => {
    const offers = await prisma.issuerOffer.findMany({
      where: {
        id: {
          in: [
            "seed-offer-amex-gold-uber-eats-credit",
            "seed-offer-csp-airbnb-credit",
            "seed-offer-venture-x-travel-multiplier",
          ],
        },
      },
      include: {
        card: true,
        merchant: true,
        userActivations: { include: { user: true } },
      },
    });

    const amexUber = offers.find(
      (offer) => offer.id === "seed-offer-amex-gold-uber-eats-credit",
    );
    const airbnb = offers.find(
      (offer) => offer.id === "seed-offer-csp-airbnb-credit",
    );

    expect(offers).toHaveLength(3);
    expect(amexUber?.card?.slug).toBe("amex-gold");
    expect(amexUber?.merchant?.slug).toBe("uber-eats");
    expect(
      amexUber?.userActivations.find(
        (activation) => activation.user.email === "beta@example.com",
      )?.status,
    ).toBe("ACTIVATED");
    expect(
      airbnb?.userActivations.find(
        (activation) => activation.user.email === "beta@example.com",
      )?.status,
    ).toBe("AVAILABLE");
  });
});

async function uniqueSeedCounts() {
  const [
    users,
    issuers,
    cards,
    currencies,
    merchants,
    sources,
    recommendationEvents,
    transactions,
    outcomes,
    corrections,
    reviewTasks,
    issuerOffers,
    offerActivations,
  ] = await Promise.all([
    prisma.user.count({
      where: { email: { in: ["beta@example.com", "admin@example.com"] } },
    }),
    prisma.issuer.count({ where: { slug: { in: expectedIssuers } } }),
    prisma.card.count({ where: { slug: { in: expectedCards } } }),
    prisma.currency.count({ where: { code: { in: expectedCurrencies } } }),
    prisma.merchant.count(),
    prisma.ruleSource.count(),
    prisma.recommendationEvent.count({
      where: { id: "seed-recommendation-local-restaurant-2026-02-15" },
    }),
    prisma.transaction.count({
      where: { id: "seed-transaction-local-restaurant-2026-02-15" },
    }),
    prisma.recommendationOutcome.count({
      where: { id: "seed-outcome-local-restaurant-2026-02-15" },
    }),
    prisma.recommendationCorrection.count({
      where: { id: "seed-correction-local-restaurant-category" },
    }),
    prisma.curatorReviewTask.count({
      where: { id: "seed-review-local-restaurant-category" },
    }),
    prisma.issuerOffer.count({
      where: { id: { startsWith: "seed-offer-" } },
    }),
    prisma.userOfferActivation.count({
      where: { issuerOfferId: { startsWith: "seed-offer-" } },
    }),
  ]);

  return {
    users,
    issuers,
    cards,
    currencies,
    merchants,
    sources,
    recommendationEvents,
    transactions,
    outcomes,
    corrections,
    reviewTasks,
    issuerOffers,
    offerActivations,
  };
}
