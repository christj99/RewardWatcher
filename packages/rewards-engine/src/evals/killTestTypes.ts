import type { ConfidenceLevel, MerchantCategory } from "../types.js";

export type KillTestOutcomeType =
  | "CAPTURED_OPTIMAL"
  | "USER_MISSED_VALUE"
  | "RECOMMENDATION_ERROR"
  | "UNMATCHED"
  | "USER_OVERRIDE"
  | "INCONCLUSIVE";

export type KillTestInput = {
  startDate: string | Date;
  endDate: string | Date;
  meaningfulMissThresholdCents: number;
  annualSubscriptionPriceCents: number;
  targetUserMinimumMissCents?: number | undefined;
  includeInconclusive?: boolean | undefined;
};

export type KillTestThresholds = {
  primaryKillTestUserShare: number;
  maxRecommendationErrorRate: number;
  maxInconclusiveRate: number;
};

export type KillTestTransactionDto = {
  id: string;
  userId: string;
  userEmail?: string | null | undefined;
  transactionDate: string | Date;
};

export type KillTestCorrectionDto = {
  id: string;
  userId: string;
  createdAt: string | Date;
};

export type KillTestOutcomeDto = {
  id: string;
  userId: string;
  userEmail?: string | null | undefined;
  outcomeType: KillTestOutcomeType;
  capturedValueCents?: number | string | null | undefined;
  missedValueCents?: number | string | null | undefined;
  recommendationEventId?: string | null | undefined;
  confidence: ConfidenceLevel;
  computedAt?: string | Date | null | undefined;
  createdAt?: string | Date | null | undefined;
  transaction: {
    id: string;
    userId?: string | null | undefined;
    transactionDate?: string | Date | null | undefined;
    amountCents: number;
    observedCategory?: MerchantCategory | string | null | undefined;
    merchantName?: string | null | undefined;
  };
  recommendationEvent?: unknown;
};

export type KillTestComputationInput = KillTestInput & {
  outcomes: KillTestOutcomeDto[];
  transactions?: KillTestTransactionDto[] | undefined;
  corrections?: KillTestCorrectionDto[] | undefined;
  primaryKillTestUserShare?: number | undefined;
  maxRecommendationErrorRate?: number | undefined;
  maxInconclusiveRate?: number | undefined;
};

export type UserKillTestSummary = {
  userId: string;
  email?: string | undefined;
  transactionCount: number;
  outcomeCount: number;
  capturedValueCents: number;
  missedValueCents: number;
  meaningfulMissedValueCents: number;
  meaningfulMissCount: number;
  recommendationErrorCount: number;
  inconclusiveCount: number;
  userOverrideCount: number;
  correctionCount: number;
  aboveSubscriptionValue: boolean;
  hasMeaningfulMiss: boolean;
};

export type KillTestMetrics = {
  startDate: string;
  endDate: string;
  meaningfulMissThresholdCents: number;
  annualSubscriptionPriceCents: number;
  totalUsersEvaluated: number;
  totalTransactionsAudited: number;
  totalOutcomes: number;
  totalMatchedRecommendations: number;
  usersWithAnyOutcome: number;
  usersWithMeaningfulMiss: number;
  percentUsersWithMeaningfulMiss: number;
  usersAboveSubscriptionValue: number;
  percentUsersAboveSubscriptionValue: number;
  totalCapturedValueCents: number;
  totalMissedValueCents: number;
  totalMeaningfulMissedValueCents: number;
  averageMissedValuePerUserCents: number;
  averageMeaningfulMissedValuePerUserCents: number;
  medianMissedValuePerUserCents: number;
  medianMeaningfulMissedValuePerUserCents: number;
  recommendationErrorCount: number;
  recommendationErrorRate: number;
  inconclusiveCount: number;
  inconclusiveRate: number;
  userOverrideCount: number;
  userOverrideRate: number;
  unmatchedOutcomeCount: number;
  unmatchedOutcomeRate: number;
  correctionCount: number;
  correctionsPer100Outcomes: number;
  outcomeTypeCounts: Record<KillTestOutcomeType, number>;
  topMissCategories: Array<{
    category: string;
    count: number;
    missedValueCents: number;
  }>;
  topMissMerchants: Array<{
    merchantName: string;
    count: number;
    missedValueCents: number;
  }>;
  topRecommendationErrorMerchants: Array<{
    merchantName: string;
    count: number;
  }>;
  passFail: {
    passesPrimaryKillTest: boolean;
    passesTrustQualityGate: boolean;
    passesDataCompletenessGate: boolean;
    overallPass: boolean;
    reasons: string[];
  };
};

export type KillTestReport = {
  metrics: KillTestMetrics;
  users: UserKillTestSummary[];
};
