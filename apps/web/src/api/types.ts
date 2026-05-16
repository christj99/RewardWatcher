export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type Lens = "CASH_OUT" | "PRACTICAL" | "ASPIRATIONAL";
export type RecommendationContext =
  | "ONLINE_CHECKOUT"
  | "MANUAL_LOOKUP"
  | "IMPORTED_TRANSACTION_REPLAY"
  | "OTHER";
export type MerchantCategory =
  | "DINING"
  | "GROCERY"
  | "TRAVEL"
  | "AIRFARE"
  | "HOTEL"
  | "RIDESHARE"
  | "GAS"
  | "DRUGSTORE"
  | "STREAMING"
  | "ONLINE_RETAIL"
  | "WHOLESALE_CLUB"
  | "GENERAL"
  | "OTHER"
  | "UNKNOWN";
export type OutcomeType =
  | "CAPTURED_OPTIMAL"
  | "USER_MISSED_VALUE"
  | "RECOMMENDATION_ERROR"
  | "UNMATCHED"
  | "USER_OVERRIDE"
  | "INCONCLUSIVE";
export type CorrectionType =
  | "WRONG_MERCHANT"
  | "WRONG_CATEGORY"
  | "WRONG_CARD_RULE"
  | "MISSED_OFFER"
  | "CAP_NOT_HANDLED"
  | "PERSONAL_PREFERENCE"
  | "OTHER";

export type FeedbackType =
  | "BUG"
  | "CONFUSING_RECOMMENDATION"
  | "WRONG_RECOMMENDATION"
  | "PLAID_ISSUE"
  | "BILLING_ISSUE"
  | "EXTENSION_ISSUE"
  | "PRIVACY_ISSUE"
  | "FEATURE_REQUEST"
  | "GENERAL_FEEDBACK";

export type FeedbackSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FeedbackStatus =
  | "OPEN"
  | "TRIAGED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED";

export type FeedbackReport = {
  id: string;
  feedbackType: FeedbackType;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  title: string;
  message: string;
  pageUrl?: string | null;
  context?: unknown;
  linkedRecommendationEventId?: string | null;
  linkedTransactionId?: string | null;
  linkedOutcomeId?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationType =
  | "PASSWORD_RESET"
  | "WEEKLY_AUDIT"
  | "REMINDER_DIGEST"
  | "BILLING_NOTICE"
  | "PRIVACY_NOTICE";

export type NotificationPreference = {
  id: string;
  userId: string;
  channel: "EMAIL";
  notificationType: NotificationType;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  plaidBetaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type IssuerSummary = { id: string; name: string; slug: string };

export type CardSummary = {
  id: string;
  name: string;
  slug: string;
  network?: string | null;
  annualFeeCents?: number | null;
  isActive?: boolean;
  issuer?: IssuerSummary | null;
};

export type UserCard = {
  id: string;
  cardId: string;
  nickname?: string | null;
  openedAt?: string | null;
  annualFeeDueMonth?: number | null;
  welcomeBonusDeadline?: string | null;
  isActive: boolean;
  card: CardSummary;
};

export type Merchant = {
  id: string;
  name: string;
  slug: string;
  category: MerchantCategory;
  websiteUrl?: string | null;
};

export type RecommendationCardResult = {
  rank: number;
  userCardId: string;
  cardId: string;
  cardName: string;
  issuerName: string;
  rewardCurrencyCode?: string;
  matchedRuleId?: string;
  matchedRuleDescription?: string;
  effectiveMultiplier?: string | number;
  expectedPoints?: string | number;
  expectedValueCents?: string | number;
  confidence: ConfidenceLevel;
  explanationParts?: string[];
  warnings?: string[];
  appliedOfferIds?: string[];
  availableButNotActivatedOfferIds?: string[];
  offerValueCents?: number;
};

export type RecommendationReceipt = {
  id: string;
  createdAt: string;
  merchant?: Merchant | null;
  merchantNameInput?: string | null;
  merchantUrlInput?: string | null;
  purchaseAmountCents?: number | null;
  context: RecommendationContext;
  lens: Lens;
  expectedCategory: MerchantCategory;
  expectedValueCents?: string | number | null;
  confidence: ConfidenceLevel;
  explanation: string;
  primaryRecommendation?: RecommendationCardResult;
  alternatives?: RecommendationCardResult[];
  warnings?: string[];
  inputSnapshot?: unknown;
  rankingSnapshot?: unknown;
  ruleSnapshot?: unknown;
  recommendedCard?: CardSummary | null;
  recommendedUserCard?: UserCard | null;
  outcomes?: RecommendationOutcome[];
  corrections?: RecommendationCorrection[];
};

export type RecommendationHistoryItem = {
  id: string;
  createdAt: string;
  merchant?: Merchant | null;
  merchantNameInput?: string | null;
  merchantUrlInput?: string | null;
  purchaseAmountCents?: number | null;
  context: RecommendationContext;
  lens: Lens;
  recommendedCard?: CardSummary | null;
  recommendedUserCard?: UserCard | null;
  expectedCategory: MerchantCategory;
  expectedValueCents?: string | number | null;
  confidence: ConfidenceLevel;
  explanation: string;
};

export type RecommendationCorrection = {
  id: string;
  correctionType: CorrectionType;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
  userNote?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  rawMerchantName: string;
  normalizedMerchantName?: string | null;
  merchant?: Merchant | null;
  amountCents: number;
  transactionDate: string;
  postedDate?: string | null;
  source: string;
  observedCategory?: MerchantCategory | null;
  observedMcc?: string | null;
  userCard?: UserCard | null;
  outcomes?: RecommendationOutcome[];
  latestOutcome?: RecommendationOutcome | null;
};

export type RecommendationOutcome = {
  id: string;
  outcomeType: OutcomeType;
  confidence: ConfidenceLevel;
  explanation: string;
  transaction?: Transaction | null;
  recommendationEvent?: RecommendationHistoryItem | null;
  actualUserCard?: UserCard | null;
  bestUserCard?: UserCard | null;
  recommendedUserCard?: UserCard | null;
  capturedValueCents?: string | number | null;
  missedValueCents?: string | number | null;
  expectedValueCents?: string | number | null;
  recommendationWasCorrect?: boolean | null;
  computedAt?: string;
};

export type WeeklyAuditItem = {
  outcomeId: string;
  transactionId: string;
  recommendationEventId?: string | null;
  transactionDate: string;
  merchantName: string;
  amountCents: number;
  outcomeType: OutcomeType;
  confidence: ConfidenceLevel;
  explanation: string;
  actualCard?: { id: string; name: string; issuerName?: string } | null;
  bestCard?: { id: string; name: string; issuerName?: string } | null;
  recommendedCard?: { id: string; name: string; issuerName?: string } | null;
  capturedValueCents?: number | null;
  missedValueCents?: number | null;
  expectedValueCents?: number | null;
  isMeaningfulMiss: boolean;
  actionText: string;
  warnings: string[];
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
  walletActions?: WalletActions;
};

export type ReminderType =
  | "ANNUAL_FEE"
  | "WELCOME_BONUS_DEADLINE"
  | "STATEMENT_CREDIT"
  | "CUSTOM";
export type ReminderStatus = "SCHEDULED" | "DUE" | "COMPLETED" | "DISMISSED";
export type ReminderRecurrence =
  | "NONE"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL";

export type Reminder = {
  id: string;
  userCardId?: string | null;
  statementCreditId?: string | null;
  reminderType: ReminderType;
  title: string;
  description?: string | null;
  dueAt: string;
  status: ReminderStatus;
  recurrence?: ReminderRecurrence | null;
  completedAt?: string | null;
  dismissedAt?: string | null;
  source: string;
  userCard?: UserCard | null;
  statementCredit?: StatementCreditSummary | null;
};

export type StatementCreditSummary = {
  id: string;
  name: string;
  description: string;
  amountCents: number;
  recurrence: string;
  category?: MerchantCategory | null;
  merchant?: Merchant | null;
};

export type StatementCreditUsage = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: "UNUSED" | "PARTIALLY_USED" | "USED" | "UNKNOWN";
  amountUsedCents?: number | null;
  estimatedRemainingCents?: number | null;
  source: string;
  evidence?: unknown;
  notes?: string | null;
  userCard?: UserCard | null;
  statementCredit: StatementCreditSummary;
};

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

export type UserOffer = {
  offer: {
    id: string;
    title: string;
    description: string;
    offerType: IssuerOfferType;
    valueCents?: number | null;
    bonusPoints?: number | null;
    bonusMultiplier?: string | number | null;
    minSpendCents?: number | null;
    maxRewardCents?: number | null;
    activationRequired: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    confidence: ConfidenceLevel;
    issuer?: IssuerSummary | null;
    card?: CardSummary | null;
    merchant?: Merchant | null;
    category?: MerchantCategory | null;
    bonusCurrency?: { id: string; code: string; name: string } | null;
  };
  userActivation: {
    id?: string | null;
    status: UserOfferStatus;
    userCardId?: string | null;
    activatedAt?: string | null;
    usedAt?: string | null;
    dismissedAt?: string | null;
    expiresAt?: string | null;
    notes?: string | null;
  };
  relevance: {
    matchingUserCards: Array<{
      id: string;
      cardId: string;
      cardName: string;
      issuerName: string;
    }>;
    reason: string;
  };
};

export type WalletActions = {
  overdueReminderCount: number;
  dueSoonReminderCount: number;
  unusedStatementCreditCount: number;
  upcomingWelcomeBonusDeadlineCount: number;
  topAction: {
    type: "REMINDER" | "STATEMENT_CREDIT" | "WELCOME_BONUS" | "NONE";
    title: string;
    description?: string | null;
    dueAt?: string;
  } | null;
};

export type PlaidConnectionStatus = "ACTIVE" | "ERROR" | "DISCONNECTED";
export type PlaidSyncStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

export type PlaidAccount = {
  id: string;
  name: string;
  officialName?: string | null;
  mask?: string | null;
  type?: string | null;
  subtype?: string | null;
  linkedUserCard?: UserCard | null;
};

export type PlaidConnection = {
  id: string;
  institutionName?: string | null;
  status: PlaidConnectionStatus;
  lastSyncedAt?: string | null;
  accounts: PlaidAccount[];
};

export type PlaidStatus = {
  betaEnabled: boolean;
  connections: PlaidConnection[];
};

export type PlaidSyncSummary = {
  syncRunId?: string;
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  importedTransactionCount: number;
  auditedTransactionCount: number;
  status?: PlaidSyncStatus;
};

export type ConsentType =
  | "PLAID_TRANSACTIONS"
  | "EMAIL_REMINDERS"
  | "TERMS_OF_SERVICE"
  | "PRIVACY_POLICY"
  | "WEEKLY_AUDIT"
  | "OFFER_TRACKING";

export type ConsentRecord = {
  id: string;
  consentType: ConsentType;
  version: string;
  grantedAt: string;
  revokedAt?: string | null;
};

export type PrivacyRequest = {
  id: string;
  requestType:
    | "DELETE_ACCOUNT"
    | "DELETE_PLAID_DATA"
    | "DELETE_TRANSACTIONS"
    | "EXPORT_DATA";
  status: "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED";
  requestedAt: string;
  completedAt?: string | null;
  summary?: unknown;
};

export type EntitlementKey =
  | "BASIC_RECOMMENDATIONS"
  | "FULL_TRANSACTION_AUDIT"
  | "WEEKLY_AUDIT_REPORT"
  | "STATEMENT_CREDIT_TRACKING"
  | "OFFER_AWARE_RECOMMENDATIONS"
  | "ADVANCED_LENSES"
  | "PLAID_SYNC"
  | "EXTENDED_HISTORY";

export type SubscriptionStatus =
  | "NONE"
  | "INCOMPLETE"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "PAUSED";

export type BillingStatus = {
  stripeCustomerId?: string | null;
  subscription?: {
    id: string;
    status: SubscriptionStatus;
    priceId?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  plan: "FREE" | "PREMIUM" | "BETA_GRANT";
  entitlements: Record<EntitlementKey, boolean>;
  checkoutAvailable: boolean;
  portalAvailable: boolean;
};
