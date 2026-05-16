import {
  BenefitType,
  BetaUserStatus,
  CapPeriod,
  CardNetwork,
  ConfidenceLevel,
  CorrectionStatus,
  CorrectionType,
  CurrencyType,
  EntitlementKey,
  EntitlementSource,
  IssuerOfferType,
  Lens,
  MerchantCategory,
  NotificationChannel,
  NotificationType,
  OutcomeType,
  PostingDataSource,
  Prisma,
  Recurrence,
  RecommendationContext,
  ReviewTaskType,
  SourceType,
  TransactionSource,
  UrlPatternType,
  UserOfferStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "./client.js";

const seedDate = new Date("2026-01-01T00:00:00.000Z");
const transactionDate = new Date("2026-02-15T12:00:00.000Z");
const computedAt = new Date("2026-02-18T12:00:00.000Z");

const issuerSeeds = [
  {
    name: "Chase",
    slug: "chase",
    websiteUrl: "https://www.chase.com",
  },
  {
    name: "American Express",
    slug: "american-express",
    websiteUrl: "https://www.americanexpress.com",
  },
  {
    name: "Capital One",
    slug: "capital-one",
    websiteUrl: "https://www.capitalone.com",
  },
] as const;

const sourceSeeds = [
  {
    sourceType: SourceType.ISSUER_PAGE,
    title: "Chase credit card rewards pages",
    url: "https://creditcards.chase.com/rewards-credit-cards",
    createdBy: "seed",
  },
  {
    sourceType: SourceType.ISSUER_PAGE,
    title: "American Express card benefits pages",
    url: "https://www.americanexpress.com/us/credit-cards/",
    createdBy: "seed",
  },
  {
    sourceType: SourceType.ISSUER_PAGE,
    title: "Capital One Venture X rewards page",
    url: "https://www.capitalone.com/credit-cards/venture-x/",
    createdBy: "seed",
  },
  {
    sourceType: SourceType.CURATOR_RESEARCH,
    title: "Rewards Audit MVP curator seed research",
    url: "https://example.com/rewards-audit/curator-seed",
    createdBy: "seed",
  },
] as const;

const currencySeeds = [
  {
    code: "USD_CASHBACK",
    name: "USD Cashback",
    currencyType: CurrencyType.CASHBACK,
  },
  {
    code: "CHASE_UR",
    name: "Chase Ultimate Rewards",
    currencyType: CurrencyType.TRANSFERABLE_POINTS,
  },
  {
    code: "AMEX_MR",
    name: "American Express Membership Rewards",
    currencyType: CurrencyType.TRANSFERABLE_POINTS,
  },
  {
    code: "CAPITAL_ONE_MILES",
    name: "Capital One Miles",
    currencyType: CurrencyType.TRANSFERABLE_POINTS,
  },
] as const;

const cardSeeds = [
  {
    issuerSlug: "chase",
    name: "Chase Sapphire Preferred",
    slug: "chase-sapphire-preferred",
    network: CardNetwork.VISA,
    annualFeeCents: 9500,
    sourceTitle: "Chase credit card rewards pages",
  },
  {
    issuerSlug: "chase",
    name: "Chase Freedom Flex",
    slug: "chase-freedom-flex",
    network: CardNetwork.MASTERCARD,
    annualFeeCents: 0,
    sourceTitle: "Chase credit card rewards pages",
  },
  {
    issuerSlug: "chase",
    name: "Chase Freedom Unlimited",
    slug: "chase-freedom-unlimited",
    network: CardNetwork.VISA,
    annualFeeCents: 0,
    sourceTitle: "Chase credit card rewards pages",
  },
  {
    issuerSlug: "american-express",
    name: "American Express Gold Card",
    slug: "amex-gold",
    network: CardNetwork.AMEX,
    annualFeeCents: 32500,
    sourceTitle: "American Express card benefits pages",
  },
  {
    issuerSlug: "american-express",
    name: "American Express Blue Cash Preferred",
    slug: "amex-blue-cash-preferred",
    network: CardNetwork.AMEX,
    annualFeeCents: 9500,
    sourceTitle: "American Express card benefits pages",
  },
  {
    issuerSlug: "capital-one",
    name: "Capital One Venture X",
    slug: "capital-one-venture-x",
    network: CardNetwork.VISA,
    annualFeeCents: 39500,
    sourceTitle: "Capital One Venture X rewards page",
  },
] as const;

const merchantSeeds = [
  {
    name: "Amazon",
    slug: "amazon",
    category: MerchantCategory.ONLINE_RETAIL,
    websiteUrl: "https://www.amazon.com",
    domain: "amazon.com",
  },
  {
    name: "Whole Foods",
    slug: "whole-foods",
    category: MerchantCategory.GROCERY,
    websiteUrl: "https://www.wholefoodsmarket.com",
    domain: "wholefoodsmarket.com",
  },
  {
    name: "Uber",
    slug: "uber",
    category: MerchantCategory.RIDESHARE,
    websiteUrl: "https://www.uber.com",
    domain: "uber.com",
  },
  {
    name: "Uber Eats",
    slug: "uber-eats",
    category: MerchantCategory.DINING,
    websiteUrl: "https://www.ubereats.com",
    domain: "ubereats.com",
  },
  {
    name: "Delta Air Lines",
    slug: "delta-air-lines",
    category: MerchantCategory.AIRFARE,
    websiteUrl: "https://www.delta.com",
    domain: "delta.com",
  },
  {
    name: "Airbnb",
    slug: "airbnb",
    category: MerchantCategory.TRAVEL,
    websiteUrl: "https://www.airbnb.com",
    domain: "airbnb.com",
  },
  {
    name: "Target",
    slug: "target",
    category: MerchantCategory.GENERAL,
    websiteUrl: "https://www.target.com",
    domain: "target.com",
  },
  {
    name: "Walmart",
    slug: "walmart",
    category: MerchantCategory.GENERAL,
    websiteUrl: "https://www.walmart.com",
    domain: "walmart.com",
  },
  {
    name: "Starbucks",
    slug: "starbucks",
    category: MerchantCategory.DINING,
    websiteUrl: "https://www.starbucks.com",
    domain: "starbucks.com",
  },
  {
    name: "Local Restaurant Test Merchant",
    slug: "local-restaurant-test-merchant",
    category: MerchantCategory.DINING,
    websiteUrl: null,
    domain: null,
  },
] as const;

type SeedContext = Awaited<ReturnType<typeof upsertSeedRoots>>;
type EarningRuleSeed = {
  id: string;
  cardSlug: string;
  currencyCode: string;
  category: MerchantCategory | null;
  multiplier: string;
  capAmountCents?: number;
  capPeriod?: CapPeriod;
  activationRequired?: boolean;
  confidence: ConfidenceLevel;
  sourceTitle: string;
  notes: string;
};

export async function seedDatabase(): Promise<void> {
  const context = await upsertSeedRoots();
  await upsertFoundingBetaEntitlements(context);

  await upsertCurrencyValuations(context);
  await upsertCardVersions(context);
  await upsertMerchantUrlPatterns(context);
  await upsertEarningRules(context);
  await upsertBenefits(context);
  await upsertStatementCredits(context);
  await upsertMerchantPostingProfiles(context);
  await upsertUserCards(context);
  await upsertIssuerOffers(context);
  await upsertAuditFixtures(context);
}

async function upsertSeedRoots() {
  const [betaUser, adminUser, freeUser] = await Promise.all([
    prisma.user.upsert({
      where: { email: "beta@example.com" },
      update: {
        displayName: "Beta User",
        plaidBetaEnabled: true,
      },
      create: {
        email: "beta@example.com",
        displayName: "Beta User",
        plaidBetaEnabled: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: {
        displayName: "Admin User",
        isAdmin: true,
      },
      create: {
        email: "admin@example.com",
        displayName: "Admin User",
        isAdmin: true,
      },
    }),
    prisma.user.upsert({
      where: { email: "free@example.com" },
      update: {
        displayName: "Free User",
        plaidBetaEnabled: false,
      },
      create: {
        email: "free@example.com",
        displayName: "Free User",
        plaidBetaEnabled: false,
      },
    }),
  ]);

  await Promise.all([
    prisma.entitlementGrant.deleteMany({
      where: { userId: freeUser.id },
    }),
    prisma.subscription.deleteMany({
      where: { userId: freeUser.id },
    }),
    ensureSeedCredential(betaUser.id, "Password12345!"),
    ensureSeedCredential(adminUser.id, "AdminPassword12345!"),
    ensureSeedCredential(freeUser.id, "FreePassword12345!"),
  ]);

  for (const userId of [betaUser.id, adminUser.id, freeUser.id]) {
    await ensureDefaultNotificationPreferences(userId);
  }
  await ensureDefaultBetaProfiles(betaUser.id, adminUser.id, freeUser.id);

  const issuers = new Map<
    string,
    Awaited<ReturnType<typeof prisma.issuer.upsert>>
  >();
  for (const issuer of issuerSeeds) {
    issuers.set(
      issuer.slug,
      await prisma.issuer.upsert({
        where: { slug: issuer.slug },
        update: issuer,
        create: issuer,
      }),
    );
  }

  const sources = new Map<
    string,
    Awaited<ReturnType<typeof prisma.ruleSource.upsert>>
  >();
  for (const source of sourceSeeds) {
    sources.set(
      source.title,
      await prisma.ruleSource.upsert({
        where: {
          sourceType_title: {
            sourceType: source.sourceType,
            title: source.title,
          },
        },
        update: {
          url: source.url,
          createdBy: source.createdBy,
          retrievedAt: seedDate,
          verifiedAt: seedDate,
        },
        create: {
          ...source,
          retrievedAt: seedDate,
          verifiedAt: seedDate,
        },
      }),
    );
  }

  const currencies = new Map<
    string,
    Awaited<ReturnType<typeof prisma.currency.upsert>>
  >();
  for (const currency of currencySeeds) {
    currencies.set(
      currency.code,
      await prisma.currency.upsert({
        where: { code: currency.code },
        update: currency,
        create: currency,
      }),
    );
  }

  const cards = new Map<
    string,
    Awaited<ReturnType<typeof prisma.card.upsert>>
  >();
  for (const card of cardSeeds) {
    const issuer = requireMapValue(issuers, card.issuerSlug);
    cards.set(
      card.slug,
      await prisma.card.upsert({
        where: { slug: card.slug },
        update: {
          issuerId: issuer.id,
          name: card.name,
          network: card.network,
          annualFeeCents: card.annualFeeCents,
          isActive: true,
        },
        create: {
          issuerId: issuer.id,
          name: card.name,
          slug: card.slug,
          network: card.network,
          annualFeeCents: card.annualFeeCents,
        },
      }),
    );
  }

  const merchants = new Map<
    string,
    Awaited<ReturnType<typeof prisma.merchant.upsert>>
  >();
  for (const merchant of merchantSeeds) {
    merchants.set(
      merchant.slug,
      await prisma.merchant.upsert({
        where: { slug: merchant.slug },
        update: {
          name: merchant.name,
          category: merchant.category,
          websiteUrl: merchant.websiteUrl,
        },
        create: {
          name: merchant.name,
          slug: merchant.slug,
          category: merchant.category,
          websiteUrl: merchant.websiteUrl,
        },
      }),
    );
  }

  return {
    betaUser,
    adminUser,
    freeUser,
    issuers,
    sources,
    currencies,
    cards,
    merchants,
  };
}

async function ensureDefaultBetaProfiles(
  betaUserId: string,
  adminUserId: string,
  freeUserId: string,
) {
  const cohort = await prisma.betaCohort.upsert({
    where: { slug: "private-beta-2026" },
    update: {
      name: "Private Beta 2026",
      description:
        "Seeded private beta cohort for local QA and support triage.",
    },
    create: {
      name: "Private Beta 2026",
      slug: "private-beta-2026",
      description:
        "Seeded private beta cohort for local QA and support triage.",
      startsAt: seedDate,
    },
  });

  await Promise.all([
    prisma.userBetaProfile.upsert({
      where: { userId: betaUserId },
      update: { cohortId: cohort.id, status: BetaUserStatus.ACTIVE },
      create: {
        userId: betaUserId,
        cohortId: cohort.id,
        status: BetaUserStatus.ACTIVE,
        invitedAt: seedDate,
        activatedAt: seedDate,
        tags: ["seeded", "beta"],
      },
    }),
    prisma.userBetaProfile.upsert({
      where: { userId: adminUserId },
      update: { cohortId: cohort.id, status: BetaUserStatus.ACTIVE },
      create: {
        userId: adminUserId,
        cohortId: cohort.id,
        status: BetaUserStatus.ACTIVE,
        invitedAt: seedDate,
        activatedAt: seedDate,
        tags: ["seeded", "admin"],
      },
    }),
    prisma.userBetaProfile.upsert({
      where: { userId: freeUserId },
      update: { cohortId: cohort.id },
      create: {
        userId: freeUserId,
        cohortId: cohort.id,
        status: BetaUserStatus.INVITED,
        invitedAt: seedDate,
        tags: ["seeded", "free"],
      },
    }),
  ]);
}

async function ensureSeedCredential(
  userId: string,
  password: string,
): Promise<void> {
  const existing = await prisma.authCredential.findUnique({
    where: { userId },
  });
  if (existing) {
    return;
  }
  await prisma.authCredential.create({
    data: {
      userId,
      passwordHash: await bcrypt.hash(password, 12),
      passwordUpdatedAt: new Date(),
    },
  });
}

async function ensureDefaultNotificationPreferences(
  userId: string,
): Promise<void> {
  for (const notificationType of [
    NotificationType.PASSWORD_RESET,
    NotificationType.WEEKLY_AUDIT,
    NotificationType.REMINDER_DIGEST,
    NotificationType.BILLING_NOTICE,
    NotificationType.PRIVACY_NOTICE,
  ]) {
    await prisma.notificationPreference.upsert({
      where: {
        userId_channel_notificationType: {
          userId,
          channel: NotificationChannel.EMAIL,
          notificationType,
        },
      },
      update: { enabled: true },
      create: {
        userId,
        channel: NotificationChannel.EMAIL,
        notificationType,
        enabled: true,
      },
    });
  }
}

async function upsertFoundingBetaEntitlements({
  betaUser,
}: SeedContext): Promise<void> {
  const premiumKeys = [
    EntitlementKey.FULL_TRANSACTION_AUDIT,
    EntitlementKey.WEEKLY_AUDIT_REPORT,
    EntitlementKey.STATEMENT_CREDIT_TRACKING,
    EntitlementKey.OFFER_AWARE_RECOMMENDATIONS,
    EntitlementKey.ADVANCED_LENSES,
    EntitlementKey.PLAID_SYNC,
    EntitlementKey.EXTENDED_HISTORY,
  ];

  for (const key of premiumKeys) {
    const existing = await prisma.entitlementGrant.findFirst({
      where: {
        userId: betaUser.id,
        key,
        source: EntitlementSource.FOUNDING_BETA,
      },
    });
    if (existing) {
      await prisma.entitlementGrant.update({
        where: { id: existing.id },
        data: {
          active: true,
          expiresAt: null,
          notes: "Seeded founding beta access.",
        },
      });
      continue;
    }

    await prisma.entitlementGrant.create({
      data: {
        userId: betaUser.id,
        key,
        source: EntitlementSource.FOUNDING_BETA,
        notes: "Seeded founding beta access.",
      },
    });
  }
}

async function upsertCurrencyValuations({
  currencies,
  sources,
}: SeedContext): Promise<void> {
  const source = requireMapValue(
    sources,
    "Rewards Audit MVP curator seed research",
  );
  const valuations = [
    ["USD_CASHBACK", Lens.CASH_OUT, "1.0", ConfidenceLevel.HIGH],
    ["USD_CASHBACK", Lens.PRACTICAL, "1.0", ConfidenceLevel.HIGH],
    ["USD_CASHBACK", Lens.ASPIRATIONAL, "1.0", ConfidenceLevel.HIGH],
    ["CHASE_UR", Lens.CASH_OUT, "1.0", ConfidenceLevel.HIGH],
    ["CHASE_UR", Lens.PRACTICAL, "1.7", ConfidenceLevel.MEDIUM],
    ["CHASE_UR", Lens.ASPIRATIONAL, "2.0", ConfidenceLevel.LOW],
    ["AMEX_MR", Lens.CASH_OUT, "0.6", ConfidenceLevel.MEDIUM],
    ["AMEX_MR", Lens.PRACTICAL, "1.6", ConfidenceLevel.MEDIUM],
    ["AMEX_MR", Lens.ASPIRATIONAL, "2.0", ConfidenceLevel.LOW],
    ["CAPITAL_ONE_MILES", Lens.CASH_OUT, "0.5", ConfidenceLevel.MEDIUM],
    ["CAPITAL_ONE_MILES", Lens.PRACTICAL, "1.4", ConfidenceLevel.MEDIUM],
    ["CAPITAL_ONE_MILES", Lens.ASPIRATIONAL, "1.8", ConfidenceLevel.LOW],
  ] as const;

  for (const [currencyCode, lens, centsPerPoint, confidence] of valuations) {
    const currency = requireMapValue(currencies, currencyCode);
    await prisma.currencyValuation.upsert({
      where: {
        currencyId_lens_effectiveFrom: {
          currencyId: currency.id,
          lens,
          effectiveFrom: seedDate,
        },
      },
      update: {
        centsPerPoint,
        confidence,
        sourceId: source.id,
        notes: "MVP seed valuation for deterministic test fixtures.",
      },
      create: {
        currencyId: currency.id,
        lens,
        centsPerPoint,
        confidence,
        sourceId: source.id,
        effectiveFrom: seedDate,
        notes: "MVP seed valuation for deterministic test fixtures.",
      },
    });
  }
}

async function upsertCardVersions({ cards }: SeedContext): Promise<void> {
  for (const card of cards.values()) {
    await prisma.cardVersion.upsert({
      where: {
        cardId_versionName: {
          cardId: card.id,
          versionName: "2026 Current Terms",
        },
      },
      update: {
        effectiveFrom: seedDate,
        annualFeeCents: card.annualFeeCents,
        notes: "Seeded current version for Phase 1 schema validation.",
      },
      create: {
        cardId: card.id,
        versionName: "2026 Current Terms",
        effectiveFrom: seedDate,
        annualFeeCents: card.annualFeeCents,
        notes: "Seeded current version for Phase 1 schema validation.",
      },
    });
  }
}

async function upsertMerchantUrlPatterns({
  merchants,
  sources,
}: SeedContext): Promise<void> {
  const source = requireMapValue(
    sources,
    "Rewards Audit MVP curator seed research",
  );
  for (const merchantSeed of merchantSeeds) {
    if (!merchantSeed.domain) {
      continue;
    }

    const merchant = requireMapValue(merchants, merchantSeed.slug);
    await prisma.merchantUrlPattern.upsert({
      where: {
        merchantId_pattern_patternType: {
          merchantId: merchant.id,
          pattern: merchantSeed.domain,
          patternType: UrlPatternType.DOMAIN,
        },
      },
      update: {
        confidence: ConfidenceLevel.HIGH,
        sourceId: source.id,
      },
      create: {
        merchantId: merchant.id,
        pattern: merchantSeed.domain,
        patternType: UrlPatternType.DOMAIN,
        confidence: ConfidenceLevel.HIGH,
        sourceId: source.id,
      },
    });
  }
}

async function upsertEarningRules(context: SeedContext): Promise<void> {
  const rules: EarningRuleSeed[] = [
    rule(
      "csp-dining",
      "chase-sapphire-preferred",
      "CHASE_UR",
      MerchantCategory.DINING,
      "3",
      "Chase credit card rewards pages",
    ),
    rule(
      "csp-travel",
      "chase-sapphire-preferred",
      "CHASE_UR",
      MerchantCategory.TRAVEL,
      "2",
      "Chase credit card rewards pages",
    ),
    baseRule(
      "csp-base",
      "chase-sapphire-preferred",
      "CHASE_UR",
      "1",
      "Chase credit card rewards pages",
    ),
    rule(
      "cff-dining",
      "chase-freedom-flex",
      "CHASE_UR",
      MerchantCategory.DINING,
      "3",
      "Chase credit card rewards pages",
    ),
    rule(
      "cff-drugstore",
      "chase-freedom-flex",
      "CHASE_UR",
      MerchantCategory.DRUGSTORE,
      "3",
      "Chase credit card rewards pages",
    ),
    {
      id: "seed-earning-rule-cff-online-retail-rotating",
      cardSlug: "chase-freedom-flex",
      currencyCode: "CHASE_UR",
      category: MerchantCategory.ONLINE_RETAIL,
      multiplier: "5",
      capAmountCents: 150000,
      capPeriod: CapPeriod.QUARTERLY,
      activationRequired: true,
      confidence: ConfidenceLevel.LOW,
      sourceTitle: "Chase credit card rewards pages",
      notes:
        "Placeholder rotating quarterly category for Phase 2 cap and activation handling tests.",
    },
    baseRule(
      "cff-base",
      "chase-freedom-flex",
      "CHASE_UR",
      "1",
      "Chase credit card rewards pages",
    ),
    rule(
      "cfu-dining",
      "chase-freedom-unlimited",
      "CHASE_UR",
      MerchantCategory.DINING,
      "3",
      "Chase credit card rewards pages",
    ),
    rule(
      "cfu-drugstore",
      "chase-freedom-unlimited",
      "CHASE_UR",
      MerchantCategory.DRUGSTORE,
      "3",
      "Chase credit card rewards pages",
    ),
    baseRule(
      "cfu-base",
      "chase-freedom-unlimited",
      "CHASE_UR",
      "1.5",
      "Chase credit card rewards pages",
    ),
    rule(
      "amex-gold-dining",
      "amex-gold",
      "AMEX_MR",
      MerchantCategory.DINING,
      "4",
      "American Express card benefits pages",
    ),
    rule(
      "amex-gold-grocery",
      "amex-gold",
      "AMEX_MR",
      MerchantCategory.GROCERY,
      "4",
      "American Express card benefits pages",
    ),
    rule(
      "amex-gold-airfare",
      "amex-gold",
      "AMEX_MR",
      MerchantCategory.AIRFARE,
      "3",
      "American Express card benefits pages",
    ),
    baseRule(
      "amex-gold-base",
      "amex-gold",
      "AMEX_MR",
      "1",
      "American Express card benefits pages",
    ),
    rule(
      "bcp-grocery",
      "amex-blue-cash-preferred",
      "USD_CASHBACK",
      MerchantCategory.GROCERY,
      "6",
      "American Express card benefits pages",
    ),
    rule(
      "bcp-streaming",
      "amex-blue-cash-preferred",
      "USD_CASHBACK",
      MerchantCategory.STREAMING,
      "6",
      "American Express card benefits pages",
    ),
    rule(
      "bcp-gas",
      "amex-blue-cash-preferred",
      "USD_CASHBACK",
      MerchantCategory.GAS,
      "3",
      "American Express card benefits pages",
    ),
    baseRule(
      "bcp-base",
      "amex-blue-cash-preferred",
      "USD_CASHBACK",
      "1",
      "American Express card benefits pages",
    ),
    baseRule(
      "venture-x-base",
      "capital-one-venture-x",
      "CAPITAL_ONE_MILES",
      "2",
      "Capital One Venture X rewards page",
    ),
    rule(
      "venture-x-travel",
      "capital-one-venture-x",
      "CAPITAL_ONE_MILES",
      MerchantCategory.TRAVEL,
      "2",
      "Capital One Venture X rewards page",
    ),
  ];

  for (const earningRule of rules) {
    const card = requireMapValue(context.cards, earningRule.cardSlug);
    const version = await currentVersionForCard(card.id);
    const rewardCurrency = requireMapValue(
      context.currencies,
      earningRule.currencyCode,
    );
    const source = requireMapValue(context.sources, earningRule.sourceTitle);

    await prisma.earningRule.upsert({
      where: { id: earningRule.id },
      update: {
        cardId: card.id,
        cardVersionId: version.id,
        rewardCurrencyId: rewardCurrency.id,
        category: earningRule.category,
        multiplier: earningRule.multiplier,
        baseRateMultiplier: earningRule.category
          ? null
          : earningRule.multiplier,
        capAmountCents: earningRule.capAmountCents ?? null,
        capPeriod: earningRule.capPeriod ?? null,
        activationRequired: earningRule.activationRequired ?? false,
        confidence: earningRule.confidence,
        sourceId: source.id,
        notes: earningRule.notes,
      },
      create: {
        id: earningRule.id,
        cardId: card.id,
        cardVersionId: version.id,
        rewardCurrencyId: rewardCurrency.id,
        category: earningRule.category,
        multiplier: earningRule.multiplier,
        baseRateMultiplier: earningRule.category
          ? null
          : earningRule.multiplier,
        capAmountCents: earningRule.capAmountCents ?? null,
        capPeriod: earningRule.capPeriod ?? null,
        activationRequired: earningRule.activationRequired ?? false,
        confidence: earningRule.confidence,
        sourceId: source.id,
        notes: earningRule.notes,
      },
    });
  }
}

async function upsertBenefits({ cards, sources }: SeedContext): Promise<void> {
  const benefitSeeds = [
    {
      id: "seed-benefit-venture-x-travel-credit",
      cardSlug: "capital-one-venture-x",
      sourceTitle: "Capital One Venture X rewards page",
      benefitType: BenefitType.TRAVEL_CREDIT,
      name: "Venture X annual travel credit",
      description:
        "Placeholder annual travel credit tracked for future reminder and audit workflows.",
      estimatedValueCents: 30000,
      confidence: ConfidenceLevel.MEDIUM,
    },
    {
      id: "seed-benefit-csp-trip-insurance",
      cardSlug: "chase-sapphire-preferred",
      sourceTitle: "Chase credit card rewards pages",
      benefitType: BenefitType.TRIP_INSURANCE,
      name: "Sapphire Preferred trip protections",
      description:
        "Simple seeded trip protection benefit for card versioning and source linkage.",
      estimatedValueCents: null,
      confidence: ConfidenceLevel.MEDIUM,
    },
    {
      id: "seed-benefit-amex-gold-dining",
      cardSlug: "amex-gold",
      sourceTitle: "American Express card benefits pages",
      benefitType: BenefitType.STATEMENT_CREDIT,
      name: "Amex Gold dining and Uber-style credits",
      description:
        "Placeholder benefit record for recurring dining and Uber-style credits.",
      estimatedValueCents: 24000,
      confidence: ConfidenceLevel.MEDIUM,
    },
  ] as const;

  for (const benefit of benefitSeeds) {
    const card = requireMapValue(cards, benefit.cardSlug);
    const version = await currentVersionForCard(card.id);
    const source = requireMapValue(sources, benefit.sourceTitle);
    await prisma.benefit.upsert({
      where: { id: benefit.id },
      update: {
        cardId: card.id,
        cardVersionId: version.id,
        sourceId: source.id,
        benefitType: benefit.benefitType,
        name: benefit.name,
        description: benefit.description,
        estimatedValueCents: benefit.estimatedValueCents,
        confidence: benefit.confidence,
      },
      create: {
        id: benefit.id,
        benefitType: benefit.benefitType,
        name: benefit.name,
        description: benefit.description,
        estimatedValueCents: benefit.estimatedValueCents,
        confidence: benefit.confidence,
        cardId: card.id,
        cardVersionId: version.id,
        sourceId: source.id,
      },
    });
  }
}

async function upsertStatementCredits({
  cards,
  merchants,
  sources,
}: SeedContext): Promise<void> {
  const credits = [
    {
      id: "seed-credit-amex-gold-uber-cash",
      cardSlug: "amex-gold",
      merchantSlug: "uber",
      sourceTitle: "American Express card benefits pages",
      name: "Amex Gold Uber Cash placeholder",
      description:
        "Monthly Uber Cash placeholder for future reminder workflows.",
      amountCents: 1000,
      recurrence: Recurrence.MONTHLY,
      category: MerchantCategory.RIDESHARE,
      confidence: ConfidenceLevel.MEDIUM,
    },
    {
      id: "seed-credit-venture-x-travel",
      cardSlug: "capital-one-venture-x",
      merchantSlug: null,
      sourceTitle: "Capital One Venture X rewards page",
      name: "Venture X travel credit placeholder",
      description:
        "Annual travel credit placeholder for future audit and reminder workflows.",
      amountCents: 30000,
      recurrence: Recurrence.ANNUAL,
      category: MerchantCategory.TRAVEL,
      confidence: ConfidenceLevel.MEDIUM,
    },
  ] as const;

  for (const credit of credits) {
    const card = requireMapValue(cards, credit.cardSlug);
    const version = await currentVersionForCard(card.id);
    const source = requireMapValue(sources, credit.sourceTitle);
    const merchantId = credit.merchantSlug
      ? requireMapValue(merchants, credit.merchantSlug).id
      : null;

    await prisma.statementCredit.upsert({
      where: { id: credit.id },
      update: {
        cardId: card.id,
        cardVersionId: version.id,
        merchantId,
        sourceId: source.id,
        name: credit.name,
        description: credit.description,
        amountCents: credit.amountCents,
        recurrence: credit.recurrence,
        category: credit.category,
        confidence: credit.confidence,
      },
      create: {
        id: credit.id,
        cardId: card.id,
        cardVersionId: version.id,
        merchantId,
        sourceId: source.id,
        name: credit.name,
        description: credit.description,
        amountCents: credit.amountCents,
        recurrence: credit.recurrence,
        category: credit.category,
        confidence: credit.confidence,
      },
    });
  }
}

async function upsertMerchantPostingProfiles({
  issuers,
  merchants,
  sources,
}: SeedContext): Promise<void> {
  const source = requireMapValue(
    sources,
    "Rewards Audit MVP curator seed research",
  );
  const chase = requireMapValue(issuers, "chase");
  const profiles = [
    [
      "whole-foods",
      "seed-posting-whole-foods",
      MerchantCategory.GROCERY,
      ConfidenceLevel.HIGH,
      "5411",
      "Whole Foods commonly posts as grocery in seeded research.",
    ],
    [
      "uber",
      "seed-posting-uber",
      MerchantCategory.RIDESHARE,
      ConfidenceLevel.MEDIUM,
      "4121",
      "Uber ride posting can vary by issuer and network.",
    ],
    [
      "uber-eats",
      "seed-posting-uber-eats",
      MerchantCategory.DINING,
      ConfidenceLevel.MEDIUM,
      "5812",
      "Uber Eats commonly posts in dining-like food service categories.",
    ],
    [
      "walmart",
      "seed-posting-walmart",
      MerchantCategory.GENERAL,
      ConfidenceLevel.MEDIUM,
      null,
      "Walmart posting may vary by store format and issuer.",
    ],
    [
      "target",
      "seed-posting-target",
      MerchantCategory.GENERAL,
      ConfidenceLevel.MEDIUM,
      null,
      "Target posting may vary by location and channel.",
    ],
  ] as const;

  for (const [
    merchantSlug,
    id,
    observedCategory,
    confidence,
    observedMcc,
    notes,
  ] of profiles) {
    const merchant = requireMapValue(merchants, merchantSlug);
    await prisma.merchantPostingProfile.upsert({
      where: { id },
      update: {
        merchantId: merchant.id,
        issuerId: chase.id,
        observedCategory,
        observedMcc,
        dataSource: PostingDataSource.CURATOR_RESEARCH,
        confidence,
        observationCount: 3,
        lastObservedAt: seedDate,
        sourceId: source.id,
        notes,
      },
      create: {
        id,
        merchantId: merchant.id,
        issuerId: chase.id,
        observedCategory,
        observedMcc,
        dataSource: PostingDataSource.CURATOR_RESEARCH,
        confidence,
        observationCount: 3,
        lastObservedAt: seedDate,
        sourceId: source.id,
        notes,
      },
    });
  }
}

async function upsertUserCards({
  betaUser,
  cards,
}: SeedContext): Promise<void> {
  const betaWallet = [
    ["amex-gold", "Amex Gold"],
    ["chase-sapphire-preferred", "Sapphire Preferred"],
    ["chase-freedom-unlimited", "Freedom Unlimited"],
    ["capital-one-venture-x", "Venture X"],
    ["chase-freedom-flex", "Freedom Flex cap fixture"],
  ] as const;

  for (const [cardSlug, nickname] of betaWallet) {
    const card = requireMapValue(cards, cardSlug);
    await prisma.userCard.upsert({
      where: {
        userId_cardId: {
          userId: betaUser.id,
          cardId: card.id,
        },
      },
      update: {
        nickname,
        isActive: true,
      },
      create: {
        userId: betaUser.id,
        cardId: card.id,
        nickname,
        openedAt: seedDate,
        isActive: true,
      },
    });
  }
}

async function upsertIssuerOffers({
  betaUser,
  cards,
  currencies,
  issuers,
  merchants,
  sources,
}: SeedContext): Promise<void> {
  const curatorSource = requireMapValue(
    sources,
    "Rewards Audit MVP curator seed research",
  );
  const offerSeeds = [
    {
      id: "seed-offer-amex-gold-uber-eats-credit",
      issuerSlug: "american-express",
      cardSlug: "amex-gold",
      merchantSlug: "uber-eats",
      category: MerchantCategory.DINING,
      title: "Amex Gold Uber Eats activation offer",
      description:
        "Seeded manually curated offer for Uber Eats purchases on Amex Gold.",
      offerType: IssuerOfferType.STATEMENT_CREDIT,
      valueCents: 1000,
      minSpendCents: 1500,
      maxRewardCents: 1000,
      activationRequired: true,
      confidence: ConfidenceLevel.MEDIUM,
      userStatus: UserOfferStatus.ACTIVATED,
    },
    {
      id: "seed-offer-csp-airbnb-credit",
      issuerSlug: "chase",
      cardSlug: "chase-sapphire-preferred",
      merchantSlug: "airbnb",
      category: MerchantCategory.TRAVEL,
      title: "Chase Sapphire Preferred Airbnb statement credit",
      description:
        "Seeded manually curated Airbnb credit for private beta offer flows.",
      offerType: IssuerOfferType.STATEMENT_CREDIT,
      valueCents: 2500,
      minSpendCents: 10000,
      maxRewardCents: 2500,
      activationRequired: true,
      confidence: ConfidenceLevel.MEDIUM,
      userStatus: UserOfferStatus.AVAILABLE,
    },
    {
      id: "seed-offer-venture-x-travel-multiplier",
      issuerSlug: "capital-one",
      cardSlug: "capital-one-venture-x",
      merchantSlug: null,
      category: MerchantCategory.TRAVEL,
      title: "Venture X travel bonus multiplier",
      description:
        "Seeded manually curated travel bonus multiplier for offer testing.",
      offerType: IssuerOfferType.BONUS_MULTIPLIER,
      valueCents: null,
      bonusCurrencyCode: "CAPITAL_ONE_MILES",
      bonusMultiplier: "3",
      minSpendCents: null,
      maxRewardCents: 5000,
      activationRequired: true,
      confidence: ConfidenceLevel.LOW,
      userStatus: UserOfferStatus.DISMISSED,
    },
  ] as const;

  for (const offer of offerSeeds) {
    const issuer = requireMapValue(issuers, offer.issuerSlug);
    const card = requireMapValue(cards, offer.cardSlug);
    const merchantId = offer.merchantSlug
      ? requireMapValue(merchants, offer.merchantSlug).id
      : null;
    const bonusCurrencyId =
      "bonusCurrencyCode" in offer && offer.bonusCurrencyCode
        ? requireMapValue(currencies, offer.bonusCurrencyCode).id
        : null;

    const savedOffer = await prisma.issuerOffer.upsert({
      where: { id: offer.id },
      update: {
        issuerId: issuer.id,
        cardId: card.id,
        merchantId,
        category: offer.category,
        title: offer.title,
        description: offer.description,
        offerType: offer.offerType,
        valueCents: offer.valueCents,
        bonusPoints: null,
        bonusCurrencyId,
        bonusMultiplier:
          "bonusMultiplier" in offer ? offer.bonusMultiplier : null,
        minSpendCents: offer.minSpendCents,
        maxRewardCents: offer.maxRewardCents,
        activationRequired: offer.activationRequired,
        startsAt: seedDate,
        endsAt: new Date("2026-12-31T23:59:59.000Z"),
        confidence: offer.confidence,
        sourceId: curatorSource.id,
        termsUrl: null,
        notes: "Seeded manually curated issuer offer for Phase 13.",
      },
      create: {
        id: offer.id,
        issuerId: issuer.id,
        cardId: card.id,
        merchantId,
        category: offer.category,
        title: offer.title,
        description: offer.description,
        offerType: offer.offerType,
        valueCents: offer.valueCents,
        bonusPoints: null,
        bonusCurrencyId,
        bonusMultiplier:
          "bonusMultiplier" in offer ? offer.bonusMultiplier : null,
        minSpendCents: offer.minSpendCents,
        maxRewardCents: offer.maxRewardCents,
        activationRequired: offer.activationRequired,
        startsAt: seedDate,
        endsAt: new Date("2026-12-31T23:59:59.000Z"),
        confidence: offer.confidence,
        sourceId: curatorSource.id,
        notes: "Seeded manually curated issuer offer for Phase 13.",
      },
    });

    const userCard = await userCardFor(betaUser.id, card.id);
    await prisma.userOfferActivation.upsert({
      where: {
        userId_issuerOfferId_userCardId: {
          userId: betaUser.id,
          issuerOfferId: savedOffer.id,
          userCardId: userCard.id,
        },
      },
      update: {
        status: offer.userStatus,
        activatedAt:
          offer.userStatus === UserOfferStatus.ACTIVATED ? seedDate : null,
        dismissedAt:
          offer.userStatus === UserOfferStatus.DISMISSED ? seedDate : null,
        expiresAt: savedOffer.endsAt,
        notes: "Seeded beta offer activation state.",
      },
      create: {
        userId: betaUser.id,
        issuerOfferId: savedOffer.id,
        userCardId: userCard.id,
        status: offer.userStatus,
        activatedAt:
          offer.userStatus === UserOfferStatus.ACTIVATED ? seedDate : null,
        dismissedAt:
          offer.userStatus === UserOfferStatus.DISMISSED ? seedDate : null,
        expiresAt: savedOffer.endsAt,
        notes: "Seeded beta offer activation state.",
      },
    });
  }
}

async function upsertAuditFixtures(context: SeedContext): Promise<void> {
  const beta = context.betaUser;
  const localRestaurant = requireMapValue(
    context.merchants,
    "local-restaurant-test-merchant",
  );
  const amexGold = requireMapValue(context.cards, "amex-gold");
  const freedomUnlimited = requireMapValue(
    context.cards,
    "chase-freedom-unlimited",
  );
  const freedomFlex = requireMapValue(context.cards, "chase-freedom-flex");

  const amexGoldUserCard = await userCardFor(beta.id, amexGold.id);
  const cfuUserCard = await userCardFor(beta.id, freedomUnlimited.id);
  const freedomFlexUserCard = await userCardFor(beta.id, freedomFlex.id);

  const rotatingRule = await prisma.earningRule.findUniqueOrThrow({
    where: { id: "seed-earning-rule-cff-online-retail-rotating" },
  });

  await prisma.capLedger.upsert({
    where: {
      userCardId_earningRuleId_periodStart: {
        userCardId: freedomFlexUserCard.id,
        earningRuleId: rotatingRule.id,
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
    update: {
      userId: beta.id,
      periodEnd: new Date("2026-03-31T23:59:59.000Z"),
      usedAmountCents: 25000,
    },
    create: {
      userId: beta.id,
      userCardId: freedomFlexUserCard.id,
      earningRuleId: rotatingRule.id,
      periodStart: new Date("2026-01-01T00:00:00.000Z"),
      periodEnd: new Date("2026-03-31T23:59:59.000Z"),
      usedAmountCents: 25000,
    },
  });

  const recommendation = await prisma.recommendationEvent.upsert({
    where: { id: "seed-recommendation-local-restaurant-2026-02-15" },
    update: {
      userId: beta.id,
      merchantId: localRestaurant.id,
      recommendedUserCardId: amexGoldUserCard.id,
      recommendedCardId: amexGold.id,
      expectedValueCents: new Prisma.Decimal("320.0"),
      inputSnapshot: {
        merchantName: localRestaurant.name,
        amountCents: 5000,
        source: "seed",
      },
      rankingSnapshot: {
        rankedCards: [
          { cardSlug: "amex-gold", expectedValueCents: "320.0" },
          { cardSlug: "chase-sapphire-preferred", expectedValueCents: "255.0" },
        ],
      },
      ruleSnapshot: {
        category: MerchantCategory.DINING,
        multiplier: "4",
        currency: "AMEX_MR",
        valuationLens: Lens.PRACTICAL,
      },
    },
    create: {
      id: "seed-recommendation-local-restaurant-2026-02-15",
      userId: beta.id,
      merchantId: localRestaurant.id,
      merchantNameInput: localRestaurant.name,
      purchaseAmountCents: 5000,
      context: RecommendationContext.MANUAL_LOOKUP,
      lens: Lens.PRACTICAL,
      recommendedUserCardId: amexGoldUserCard.id,
      recommendedCardId: amexGold.id,
      expectedCategory: MerchantCategory.DINING,
      expectedValueCents: new Prisma.Decimal("320.0"),
      confidence: ConfidenceLevel.HIGH,
      explanation:
        "Seed fixture: Amex Gold earns 4x Membership Rewards on dining at the practical valuation lens.",
      inputSnapshot: {
        merchantName: localRestaurant.name,
        amountCents: 5000,
        source: "seed",
      },
      rankingSnapshot: {
        rankedCards: [
          { cardSlug: "amex-gold", expectedValueCents: "320.0" },
          { cardSlug: "chase-sapphire-preferred", expectedValueCents: "255.0" },
        ],
      },
      ruleSnapshot: {
        category: MerchantCategory.DINING,
        multiplier: "4",
        currency: "AMEX_MR",
        valuationLens: Lens.PRACTICAL,
      },
    },
  });

  const transaction = await prisma.transaction.upsert({
    where: { id: "seed-transaction-local-restaurant-2026-02-15" },
    update: {
      userId: beta.id,
      userCardId: cfuUserCard.id,
      merchantId: localRestaurant.id,
      amountCents: 5000,
      observedCategory: MerchantCategory.DINING,
      rawData: {
        fixture: true,
        note: "User paid with Freedom Unlimited instead of the recommended Amex Gold.",
      },
    },
    create: {
      id: "seed-transaction-local-restaurant-2026-02-15",
      userId: beta.id,
      userCardId: cfuUserCard.id,
      merchantId: localRestaurant.id,
      rawMerchantName: "LOCAL RESTAURANT TEST MERCHANT",
      normalizedMerchantName: localRestaurant.name,
      amountCents: 5000,
      transactionDate,
      postedDate: new Date("2026-02-16T12:00:00.000Z"),
      source: TransactionSource.TEST_FIXTURE,
      externalId: "seed-local-restaurant-2026-02-15",
      observedCategory: MerchantCategory.DINING,
      rawData: {
        fixture: true,
        note: "User paid with Freedom Unlimited instead of the recommended Amex Gold.",
      },
    },
  });

  await prisma.recommendationOutcome.upsert({
    where: { id: "seed-outcome-local-restaurant-2026-02-15" },
    update: {
      userId: beta.id,
      recommendationEventId: recommendation.id,
      transactionId: transaction.id,
      actualUserCardId: cfuUserCard.id,
      bestUserCardId: amexGoldUserCard.id,
      recommendedUserCardId: amexGoldUserCard.id,
    },
    create: {
      id: "seed-outcome-local-restaurant-2026-02-15",
      userId: beta.id,
      recommendationEventId: recommendation.id,
      transactionId: transaction.id,
      outcomeType: OutcomeType.USER_MISSED_VALUE,
      actualUserCardId: cfuUserCard.id,
      bestUserCardId: amexGoldUserCard.id,
      recommendedUserCardId: amexGoldUserCard.id,
      expectedValueCents: new Prisma.Decimal("320.0"),
      capturedValueCents: new Prisma.Decimal("255.0"),
      missedValueCents: new Prisma.Decimal("65.0"),
      recommendationWasCorrect: true,
      confidence: ConfidenceLevel.MEDIUM,
      explanation:
        "Seed fixture: recommendation was correct, but the posted transaction used a different wallet card.",
      computedAt,
    },
  });

  const correction = await prisma.recommendationCorrection.upsert({
    where: { id: "seed-correction-local-restaurant-category" },
    update: {
      userId: beta.id,
      recommendationEventId: recommendation.id,
      transactionId: transaction.id,
      status: CorrectionStatus.OPEN,
    },
    create: {
      id: "seed-correction-local-restaurant-category",
      userId: beta.id,
      recommendationEventId: recommendation.id,
      transactionId: transaction.id,
      correctionType: CorrectionType.WRONG_CATEGORY,
      userNote:
        "Seed correction: review whether this local merchant always posts as dining.",
      status: CorrectionStatus.OPEN,
    },
  });

  await prisma.curatorReviewTask.upsert({
    where: { id: "seed-review-local-restaurant-category" },
    update: {
      correctionId: correction.id,
      status: "OPEN",
      priority: "MEDIUM",
    },
    create: {
      id: "seed-review-local-restaurant-category",
      correctionId: correction.id,
      taskType: ReviewTaskType.MERCHANT_MAPPING_REVIEW,
      title: "Review local restaurant category mapping",
      description:
        "Seed review task linked to a user correction for merchant-category data quality.",
    },
  });
}

function rule(
  key: string,
  cardSlug: string,
  currencyCode: string,
  category: MerchantCategory,
  multiplier: string,
  sourceTitle: string,
) {
  return {
    id: `seed-earning-rule-${key}`,
    cardSlug,
    currencyCode,
    category,
    multiplier,
    confidence: ConfidenceLevel.HIGH,
    sourceTitle,
    notes: `${category} earning rule seeded for Phase 1.`,
  } as const;
}

function baseRule(
  key: string,
  cardSlug: string,
  currencyCode: string,
  multiplier: string,
  sourceTitle: string,
) {
  return {
    id: `seed-earning-rule-${key}`,
    cardSlug,
    currencyCode,
    category: null,
    multiplier,
    confidence: ConfidenceLevel.HIGH,
    sourceTitle,
    notes:
      "Base/everywhere earning rule; category and merchant are intentionally null.",
  } as const;
}

async function currentVersionForCard(cardId: string) {
  return prisma.cardVersion.findUniqueOrThrow({
    where: {
      cardId_versionName: {
        cardId,
        versionName: "2026 Current Terms",
      },
    },
  });
}

async function userCardFor(userId: string, cardId: string) {
  return prisma.userCard.findUniqueOrThrow({
    where: {
      userId_cardId: {
        userId,
        cardId,
      },
    },
  });
}

function requireMapValue<Key, Value>(map: Map<Key, Value>, key: Key): Value {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Missing seed dependency for key: ${String(key)}`);
  }

  return value;
}
