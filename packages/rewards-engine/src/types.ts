export const confidenceLevels = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

export const lenses = ["CASH_OUT", "PRACTICAL", "ASPIRATIONAL"] as const;
export type Lens = (typeof lenses)[number];

export const merchantCategories = [
  "DINING",
  "GROCERY",
  "TRAVEL",
  "AIRFARE",
  "HOTEL",
  "RIDESHARE",
  "GAS",
  "DRUGSTORE",
  "STREAMING",
  "ONLINE_RETAIL",
  "WHOLESALE_CLUB",
  "GENERAL",
  "OTHER",
  "UNKNOWN",
] as const;
export type MerchantCategory = (typeof merchantCategories)[number];

export type RecommendationContext =
  | "ONLINE_CHECKOUT"
  | "MANUAL_LOOKUP"
  | "IMPORTED_TRANSACTION_REPLAY"
  | "OTHER";

export type CapPeriod = "MONTHLY" | "QUARTERLY" | "ANNUAL" | "LIFETIME";
export type PreferenceType =
  | "PREFER_CARD"
  | "AVOID_CARD"
  | "IGNORE_CATEGORY"
  | "CUSTOM_NOTE";
export type ResolutionMethod = "ID" | "URL" | "NAME" | "UNKNOWN";
export type IssuerOfferType =
  | "STATEMENT_CREDIT"
  | "BONUS_POINTS"
  | "BONUS_MULTIPLIER"
  | "DISCOUNT"
  | "OTHER";
export type UserOfferStatus =
  | "AVAILABLE"
  | "ACTIVATED"
  | "USED"
  | "EXPIRED"
  | "DISMISSED";

export type DecimalLike = string | number | { toString(): string };

export type RecommendationInput = {
  userId: string;
  merchantId?: string | undefined;
  merchantUrl?: string | undefined;
  merchantName?: string | undefined;
  purchaseAmountCents?: number | undefined;
  timestamp?: Date | string | undefined;
  lens?: Lens | undefined;
  context?: RecommendationContext | undefined;
  categoryOverride?: MerchantCategory | undefined;
  categoryOverrideReason?: string | undefined;
  ignoreUserPreferences?: boolean | undefined;
};

export type NormalizedRecommendationInput = {
  userId: string;
  merchantId?: string | undefined;
  merchantUrl?: string | undefined;
  merchantName?: string | undefined;
  purchaseAmountCents: number;
  timestamp: Date;
  lens: Lens;
  context: RecommendationContext;
  categoryOverride?: MerchantCategory | undefined;
  categoryOverrideReason?: string | undefined;
  ignoreUserPreferences: boolean;
};

export type EngineMerchant = {
  id: string;
  name: string;
  category: MerchantCategory;
};

export type EngineIssuer = {
  id: string;
  name: string;
  slug?: string;
};

export type EngineCard = {
  id: string;
  name: string;
  slug?: string;
  issuer: EngineIssuer;
  network?: string | null;
  annualFeeCents?: number | null;
  isActive?: boolean;
};

export type EngineUserCard = {
  id: string;
  userId: string;
  cardId: string;
  isActive: boolean;
  nickname?: string | null;
  card: EngineCard;
};

export type EngineCurrency = {
  id: string;
  code: string;
  name?: string;
  currencyType?: string;
};

export type EngineCurrencyValuation = {
  id: string;
  currencyId: string;
  lens: Lens;
  centsPerPoint: DecimalLike;
  confidence: ConfidenceLevel;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
};

export type EngineEarningRule = {
  id: string;
  cardId: string;
  cardVersionId?: string | null;
  rewardCurrency: EngineCurrency;
  rewardCurrencyId?: string;
  category?: MerchantCategory | null;
  merchantId?: string | null;
  multiplier: DecimalLike;
  baseRateMultiplier?: DecimalLike | null;
  capAmountCents?: number | null;
  capPeriod?: CapPeriod | null;
  activationRequired: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  confidence: ConfidenceLevel;
  sourceId?: string | null;
  notes?: string | null;
};

export type EngineCapLedger = {
  id: string;
  userId: string;
  userCardId: string;
  earningRuleId: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  usedAmountCents: number;
};

export type EngineMerchantPostingProfile = {
  id: string;
  merchantId: string;
  observedCategory: MerchantCategory;
  confidence: ConfidenceLevel;
  observationCount?: number;
  notes?: string | null;
};

export type EngineUserPreferenceRule = {
  id: string;
  userId: string;
  cardId?: string | null;
  merchantId?: string | null;
  category?: MerchantCategory | null;
  preferenceType: PreferenceType;
  reason?: string | null;
};

export type EngineIssuerOffer = {
  id: string;
  issuerId?: string | null;
  cardId?: string | null;
  merchantId?: string | null;
  category?: MerchantCategory | null;
  title: string;
  description: string;
  offerType: IssuerOfferType;
  valueCents?: number | null;
  bonusPoints?: number | null;
  bonusCurrency?: EngineCurrency | null;
  bonusCurrencyId?: string | null;
  bonusMultiplier?: DecimalLike | null;
  minSpendCents?: number | null;
  maxRewardCents?: number | null;
  activationRequired: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  confidence: ConfidenceLevel;
  sourceId?: string | null;
  notes?: string | null;
  userCardId?: string | null;
  userStatus: UserOfferStatus;
};

export type OfferApplicationResult = {
  offerId: string;
  title: string;
  status: UserOfferStatus;
  valueCents: number;
  confidence: ConfidenceLevel;
  warning?: string;
};

export type ResolvedMerchant = {
  id?: string;
  name?: string;
  category: MerchantCategory;
  confidence: ConfidenceLevel;
  resolutionMethod: ResolutionMethod;
  warnings: string[];
  appliedOfferIds?: string[] | undefined;
  availableButNotActivatedOfferIds?: string[] | undefined;
  offerValueCents?: number | undefined;
};

export type ExpectedCategoryResolution = {
  category: MerchantCategory;
  confidence: ConfidenceLevel;
  postingProfileId?: string;
  warnings: string[];
};

export type RecommendedCardResult = {
  rank: number;
  userCardId: string;
  cardId: string;
  cardName: string;
  issuerName: string;
  rewardCurrencyCode: string;
  matchedRuleId?: string | undefined;
  matchedRuleDescription?: string | undefined;
  effectiveMultiplier: number;
  expectedPoints: number;
  expectedValueCents: number;
  confidence: ConfidenceLevel;
  explanationParts: string[];
  warnings: string[];
  appliedOfferIds?: string[] | undefined;
  availableButNotActivatedOfferIds?: string[] | undefined;
  offerValueCents?: number | undefined;
};

export type RecommendationResult = {
  input: {
    userId: string;
    merchantId?: string | undefined;
    merchantUrl?: string | undefined;
    merchantName?: string | undefined;
    purchaseAmountCents: number;
    timestamp: string;
    lens: Lens;
    context: RecommendationContext;
  };
  resolvedMerchant: ResolvedMerchant;
  expectedCategory: MerchantCategory;
  primaryRecommendation: RecommendedCardResult;
  alternatives: RecommendedCardResult[];
  warnings: string[];
  confidence: ConfidenceLevel;
  explanation: string;
  inputSnapshot: Record<string, unknown>;
  rankingSnapshot: Record<string, unknown>;
  ruleSnapshot: Record<string, unknown>;
};
