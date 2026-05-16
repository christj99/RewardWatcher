import type { ConfidenceLevel } from "../types.js";
import type { OutcomeType } from "./auditTypes.js";

export type WeeklyCardSummary = {
  id: string;
  name: string;
  issuerName?: string | undefined;
};

export type WeeklyAuditOutcomeInput = {
  outcomeId: string;
  transactionId: string;
  recommendationEventId?: string | null | undefined;
  transactionDate: Date | string;
  merchantName: string;
  amountCents: number;
  outcomeType: OutcomeType;
  confidence: ConfidenceLevel;
  explanation: string;
  actualCard?: WeeklyCardSummary | null | undefined;
  bestCard?: WeeklyCardSummary | null | undefined;
  recommendedCard?: WeeklyCardSummary | null | undefined;
  capturedValueCents?: number | null | undefined;
  missedValueCents?: number | null | undefined;
  expectedValueCents?: number | null | undefined;
  warnings?: string[] | undefined;
};

export type WeeklyAuditItem = WeeklyAuditOutcomeInput & {
  transactionDate: string;
  isMeaningfulMiss: boolean;
  actionText: string;
  warnings: string[];
};

export type WeeklyAuditReportInput = {
  weekStart: Date | string;
  weekEnd: Date | string;
  minMissedValueCents?: number | undefined;
  includeInconclusive?: boolean | undefined;
  includeUnmatched?: boolean | undefined;
  limitItems?: number | undefined;
  outcomes: WeeklyAuditOutcomeInput[];
};

export type WeeklyAuditReport = {
  weekStart: string;
  weekEnd: string;
  minMissedValueCents: number;
  totalTransactionsAudited: number;
  totalOutcomes: number;
  totalRecommendationsMatched: number;
  estimatedValueCapturedCents: number;
  estimatedValueMissedCents: number;
  meaningfulMissedValueCents: number;
  meaningfulMissCount: number;
  capturedOptimalCount: number;
  userMissedValueCount: number;
  recommendationErrorCount: number;
  unmatchedCount: number;
  userOverrideCount: number;
  inconclusiveCount: number;
  topMiss: WeeklyAuditItem | null;
  recommendedAction: string | null;
  confidenceNotes: string[];
  items: WeeklyAuditItem[];
};
