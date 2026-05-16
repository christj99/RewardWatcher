import type {
  ConfidenceLevel,
  Lens,
  MerchantCategory,
  RecommendationContext,
  RecommendationResult,
  RecommendedCardResult,
} from "../types.js";

export type TransactionSource =
  | "MANUAL"
  | "CSV_IMPORT"
  | "PLAID"
  | "TEST_FIXTURE";

export type OutcomeType =
  | "CAPTURED_OPTIMAL"
  | "USER_MISSED_VALUE"
  | "RECOMMENDATION_ERROR"
  | "UNMATCHED"
  | "USER_OVERRIDE"
  | "INCONCLUSIVE";

export type AuditTransactionInput = {
  id: string;
  userId: string;
  userCardId?: string | null;
  cardId?: string | null;
  merchantId?: string | null;
  rawMerchantName: string;
  normalizedMerchantName?: string | null;
  amountCents: number;
  currencyCode: string;
  transactionDate: Date | string;
  postedDate?: Date | string | null;
  observedCategory?: MerchantCategory | null;
  observedMcc?: string | null;
  source: TransactionSource;
};

export type AuditRecommendationCandidate = {
  id: string;
  userId: string;
  merchantId?: string | null;
  merchantNameInput?: string | null;
  merchantUrlInput?: string | null;
  purchaseAmountCents?: number | null;
  context: RecommendationContext;
  lens: Lens;
  recommendedUserCardId?: string | null;
  recommendedCardId: string;
  expectedCategory: MerchantCategory;
  expectedValueCents: number | string;
  confidence: ConfidenceLevel;
  explanation: string;
  createdAt: Date | string;
  inputSnapshot?: unknown;
  rankingSnapshot?: unknown;
  ruleSnapshot?: unknown;
};

export type RecommendationMatchResult = {
  recommendationEventId?: string;
  score: number;
  matched: boolean;
  reasons: string[];
  warnings: string[];
};

export type ActualCardValueResult = {
  userCardId?: string | null;
  cardId?: string | null;
  cardName?: string;
  expectedValueCents?: number;
  matchedRuleId?: string;
  confidence: ConfidenceLevel;
  explanation: string;
  warnings: string[];
};

export type AuditOutcomeComputationInput = {
  transaction: AuditTransactionInput;
  matchedRecommendation?: AuditRecommendationCandidate | null;
  bestRecommendationResult?: RecommendationResult | null;
  actualCardValue?: ActualCardValueResult | null;
  thresholdCents?: number;
  hasUserOverride?: boolean;
  match?: RecommendationMatchResult;
};

export type AuditOutcomeResult = {
  outcomeType: OutcomeType;
  recommendationEventId?: string | null;
  transactionId: string;
  actualUserCardId?: string | null;
  bestUserCardId?: string | null;
  recommendedUserCardId?: string | null;
  expectedValueCents?: number;
  capturedValueCents?: number;
  missedValueCents?: number;
  recommendationWasCorrect?: boolean | null;
  confidence: ConfidenceLevel;
  explanation: string;
  match?: RecommendationMatchResult;
  warnings: string[];
};

export type ScoredRecommendationCard = Pick<
  RecommendedCardResult,
  | "userCardId"
  | "cardId"
  | "cardName"
  | "expectedValueCents"
  | "matchedRuleId"
  | "confidence"
  | "warnings"
>;
