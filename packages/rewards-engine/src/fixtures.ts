import type { RewardsEngineRepository } from "./repositories.js";
import type {
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
} from "./types.js";
import { normalizeMerchantUrl } from "./merchantResolution.js";

export type InMemoryRewardsEngineData = {
  wallet?: EngineUserCard[];
  merchants?: EngineMerchant[];
  merchantDomains?: Record<string, string>;
  postingProfiles?: EngineMerchantPostingProfile[];
  earningRules?: EngineEarningRule[];
  valuations?: EngineCurrencyValuation[];
  capLedgers?: EngineCapLedger[];
  preferences?: EngineUserPreferenceRule[];
  offers?: EngineIssuerOffer[];
};

export class InMemoryRewardsEngineRepository
  implements RewardsEngineRepository
{
  private readonly wallet: EngineUserCard[];
  private readonly merchants: EngineMerchant[];
  private readonly merchantDomains: Record<string, string>;
  private readonly postingProfiles: EngineMerchantPostingProfile[];
  private readonly earningRules: EngineEarningRule[];
  private readonly valuations: EngineCurrencyValuation[];
  private readonly capLedgers: EngineCapLedger[];
  private readonly preferences: EngineUserPreferenceRule[];
  private readonly offers: EngineIssuerOffer[];

  constructor(data: InMemoryRewardsEngineData = {}) {
    this.wallet = data.wallet ?? defaultWallet;
    this.merchants = data.merchants ?? defaultMerchants;
    this.merchantDomains = data.merchantDomains ?? defaultMerchantDomains;
    this.postingProfiles = data.postingProfiles ?? [];
    this.earningRules = data.earningRules ?? defaultEarningRules;
    this.valuations = data.valuations ?? defaultValuations;
    this.capLedgers = data.capLedgers ?? [];
    this.preferences = data.preferences ?? [];
    this.offers = data.offers ?? [];
  }

  async getUserWallet(userId: string): Promise<EngineUserCard[]> {
    return this.wallet.filter((userCard) => userCard.userId === userId);
  }

  async findMerchantById(merchantId: string): Promise<EngineMerchant | null> {
    return (
      this.merchants.find((merchant) => merchant.id === merchantId) ?? null
    );
  }

  async findMerchantByUrl(url: string): Promise<EngineMerchant | null> {
    const normalized = normalizeMerchantUrl(url);
    if (!normalized) {
      return null;
    }

    const merchantId = this.merchantDomains[normalized];
    return merchantId ? this.findMerchantById(merchantId) : null;
  }

  async findMerchantByName(name: string): Promise<EngineMerchant | null> {
    const normalizedName = name.trim().toLowerCase();
    return (
      this.merchants.find(
        (merchant) => merchant.name.toLowerCase() === normalizedName,
      ) ?? null
    );
  }

  async getMerchantPostingProfiles(
    merchantId: string,
  ): Promise<EngineMerchantPostingProfile[]> {
    return this.postingProfiles.filter(
      (profile) => profile.merchantId === merchantId,
    );
  }

  async getEarningRulesForCards(
    cardIds: string[],
    timestamp: Date,
  ): Promise<EngineEarningRule[]> {
    void timestamp;
    return this.earningRules.filter((rule) => cardIds.includes(rule.cardId));
  }

  async getCurrencyValuations(
    currencyIds: string[],
    lens: Lens,
    timestamp: Date,
  ): Promise<EngineCurrencyValuation[]> {
    return this.valuations.filter((valuation) => {
      const effectiveFrom = valuation.effectiveFrom
        ? new Date(valuation.effectiveFrom)
        : null;
      const effectiveTo = valuation.effectiveTo
        ? new Date(valuation.effectiveTo)
        : null;

      return (
        currencyIds.includes(valuation.currencyId) &&
        valuation.lens === lens &&
        (!effectiveFrom || effectiveFrom <= timestamp) &&
        (!effectiveTo || effectiveTo >= timestamp)
      );
    });
  }

  async getCapLedgers(
    userId: string,
    userCardIds: string[],
    timestamp: Date,
  ): Promise<EngineCapLedger[]> {
    return this.capLedgers.filter(
      (ledger) =>
        ledger.userId === userId &&
        userCardIds.includes(ledger.userCardId) &&
        new Date(ledger.periodStart) <= timestamp &&
        new Date(ledger.periodEnd) >= timestamp,
    );
  }

  async getUserPreferenceRules(
    userId: string,
    merchantId: string | undefined,
    category: MerchantCategory,
  ): Promise<EngineUserPreferenceRule[]> {
    return this.preferences.filter((preference) => {
      const merchantMatches =
        !preference.merchantId || preference.merchantId === merchantId;
      const categoryMatches =
        !preference.category || preference.category === category;
      return preference.userId === userId && merchantMatches && categoryMatches;
    });
  }

  async getActiveOffersForUser(
    userId: string,
    userCardIds: string[],
    merchantId: string | undefined,
    category: MerchantCategory,
    timestamp: Date,
  ): Promise<EngineIssuerOffer[]> {
    void userId;
    return this.offers.filter((offer) => {
      const startsAt = offer.startsAt ? new Date(offer.startsAt) : null;
      const endsAt = offer.endsAt ? new Date(offer.endsAt) : null;
      const merchantMatches =
        !offer.merchantId || offer.merchantId === merchantId;
      const categoryMatches = !offer.category || offer.category === category;
      const userCardMatches =
        !offer.userCardId || userCardIds.includes(offer.userCardId);
      return (
        merchantMatches &&
        categoryMatches &&
        userCardMatches &&
        (!startsAt || startsAt <= timestamp) &&
        (!endsAt || endsAt >= timestamp)
      );
    });
  }
}

export const defaultMerchants: EngineMerchant[] = [
  { id: "merchant-dining", name: "Local Restaurant", category: "DINING" },
  { id: "merchant-grocery", name: "Whole Foods", category: "GROCERY" },
  { id: "merchant-general", name: "Target", category: "GENERAL" },
  { id: "merchant-online", name: "Amazon", category: "ONLINE_RETAIL" },
];

export const defaultMerchantDomains = {
  "local.test": "merchant-dining",
  "wholefoodsmarket.com": "merchant-grocery",
  "target.com": "merchant-general",
  "amazon.com": "merchant-online",
};

export const currencies = {
  chaseUr: { id: "currency-chase-ur", code: "CHASE_UR" },
  amexMr: { id: "currency-amex-mr", code: "AMEX_MR" },
  cash: { id: "currency-cash", code: "USD_CASHBACK" },
  capitalOne: { id: "currency-capital-one", code: "CAPITAL_ONE_MILES" },
} as const;

export const defaultWallet: EngineUserCard[] = [
  userCard(
    "uc-amex-gold",
    "card-amex-gold",
    "American Express Gold Card",
    "American Express",
  ),
  userCard(
    "uc-blue-cash",
    "card-blue-cash",
    "Amex Blue Cash Preferred",
    "American Express",
  ),
  userCard("uc-csp", "card-csp", "Chase Sapphire Preferred", "Chase"),
  userCard(
    "uc-venture-x",
    "card-venture-x",
    "Capital One Venture X",
    "Capital One",
  ),
];

export const defaultValuations: EngineCurrencyValuation[] = [
  valuation(
    "val-chase-practical",
    currencies.chaseUr.id,
    "PRACTICAL",
    "1.7",
    "MEDIUM",
  ),
  valuation(
    "val-amex-practical",
    currencies.amexMr.id,
    "PRACTICAL",
    "1.6",
    "MEDIUM",
  ),
  valuation(
    "val-cash-practical",
    currencies.cash.id,
    "PRACTICAL",
    "1.0",
    "HIGH",
  ),
  valuation(
    "val-capital-one-practical",
    currencies.capitalOne.id,
    "PRACTICAL",
    "1.4",
    "MEDIUM",
  ),
];

export const defaultEarningRules: EngineEarningRule[] = [
  earningRule(
    "rule-amex-dining",
    "card-amex-gold",
    currencies.amexMr,
    "DINING",
    "4",
    "HIGH",
  ),
  earningRule(
    "rule-amex-grocery",
    "card-amex-gold",
    currencies.amexMr,
    "GROCERY",
    "4",
    "HIGH",
  ),
  baseRule("rule-amex-base", "card-amex-gold", currencies.amexMr, "1"),
  earningRule(
    "rule-bcp-grocery",
    "card-blue-cash",
    currencies.cash,
    "GROCERY",
    "6",
    "HIGH",
  ),
  baseRule("rule-bcp-base", "card-blue-cash", currencies.cash, "1"),
  earningRule(
    "rule-csp-dining",
    "card-csp",
    currencies.chaseUr,
    "DINING",
    "3",
    "HIGH",
  ),
  earningRule(
    "rule-csp-travel",
    "card-csp",
    currencies.chaseUr,
    "TRAVEL",
    "2",
    "HIGH",
  ),
  baseRule("rule-csp-base", "card-csp", currencies.chaseUr, "1"),
  baseRule("rule-venture-x-base", "card-venture-x", currencies.capitalOne, "2"),
];

export function userCard(
  id: string,
  cardId: string,
  cardName: string,
  issuerName: string,
): EngineUserCard {
  return {
    id,
    userId: "user-1",
    cardId,
    isActive: true,
    card: {
      id: cardId,
      name: cardName,
      issuer: {
        id: `issuer-${issuerName.toLowerCase().replaceAll(" ", "-")}`,
        name: issuerName,
      },
    },
  };
}

export function valuation(
  id: string,
  currencyId: string,
  lens: Lens,
  centsPerPoint: string,
  confidence: EngineCurrencyValuation["confidence"],
): EngineCurrencyValuation {
  return {
    id,
    currencyId,
    lens,
    centsPerPoint,
    confidence,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
  };
}

export function earningRule(
  id: string,
  cardId: string,
  rewardCurrency: EngineEarningRule["rewardCurrency"],
  category: MerchantCategory,
  multiplier: string,
  confidence: EngineEarningRule["confidence"] = "HIGH",
): EngineEarningRule {
  return {
    id,
    cardId,
    rewardCurrency,
    category,
    multiplier,
    activationRequired: false,
    confidence,
    notes: `${category} rule`,
  };
}

export function baseRule(
  id: string,
  cardId: string,
  rewardCurrency: EngineEarningRule["rewardCurrency"],
  multiplier: string,
): EngineEarningRule {
  return {
    id,
    cardId,
    rewardCurrency,
    category: null,
    merchantId: null,
    multiplier,
    baseRateMultiplier: multiplier,
    activationRequired: false,
    confidence: "HIGH",
    notes: "Base/everywhere rule",
  };
}
