import type {
  CapPeriod,
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

export type RewardsEngineRepository = {
  getUserWallet(userId: string): Promise<EngineUserCard[]>;
  findMerchantById(merchantId: string): Promise<EngineMerchant | null>;
  findMerchantByUrl(url: string): Promise<EngineMerchant | null>;
  findMerchantByName(name: string): Promise<EngineMerchant | null>;
  getMerchantPostingProfiles(
    merchantId: string,
  ): Promise<EngineMerchantPostingProfile[]>;
  getEarningRulesForCards(
    cardIds: string[],
    timestamp: Date,
  ): Promise<EngineEarningRule[]>;
  getCurrencyValuations(
    currencyIds: string[],
    lens: Lens,
    timestamp: Date,
  ): Promise<EngineCurrencyValuation[]>;
  getCapLedgers(
    userId: string,
    userCardIds: string[],
    timestamp: Date,
  ): Promise<EngineCapLedger[]>;
  getUserPreferenceRules(
    userId: string,
    merchantId: string | undefined,
    category: MerchantCategory,
  ): Promise<EngineUserPreferenceRule[]>;
  getActiveOffersForUser?(
    userId: string,
    userCardIds: string[],
    merchantId: string | undefined,
    category: MerchantCategory,
    timestamp: Date,
  ): Promise<EngineIssuerOffer[]>;
};

export type CapWindow = {
  periodStart: Date;
  periodEnd: Date;
  capPeriod: CapPeriod;
};
