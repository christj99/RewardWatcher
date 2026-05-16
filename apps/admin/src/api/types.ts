export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type MerchantCategory =
  | "GENERAL"
  | "GROCERY"
  | "DINING"
  | "TRAVEL"
  | "HOTEL"
  | "AIRFARE"
  | "RIDESHARE"
  | "GAS"
  | "DRUGSTORE"
  | "ONLINE_RETAIL"
  | "WHOLESALE_CLUB"
  | "ENTERTAINMENT"
  | "UNKNOWN";

export type AdminAuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "RETIRE"
  | "EXPIRE"
  | "RESOLVE"
  | "REJECT"
  | "LINK"
  | "UNLINK"
  | "OTHER";

export type CardSummary = {
  id: string;
  name: string;
  slug?: string;
  issuer?: { id: string; name: string; slug?: string } | null;
  issuerName?: string;
  annualFeeCents?: number | null;
  isActive?: boolean;
};

export type MerchantSummary = {
  id: string;
  name: string;
  slug?: string;
  category?: MerchantCategory;
  websiteUrl?: string | null;
};

export type AdminList<T> = T[] | { items: T[] } | { data: T[] };

export type AdminAuditLog = {
  id: string;
  action: AdminAuditAction;
  entityType: string;
  entityId?: string | null;
  before?: JsonValue;
  after?: JsonValue;
  metadata?: JsonValue;
  createdAt: string;
  adminUser?: { email?: string; displayName?: string | null } | null;
};

export type AdminEmailLog = {
  id: string;
  userId?: string | null;
  toEmailRedacted: string;
  emailType: string;
  subject: string;
  status: string;
  provider: string;
  providerMessageId?: string | null;
  idempotencyKey?: string | null;
  metadata?: JsonValue;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
  user?: { email?: string; displayName?: string | null } | null;
};

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

export type AdminFeedbackReport = {
  id: string;
  feedbackType: FeedbackType;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  title: string;
  message: string;
  pageUrl?: string | null;
  context?: JsonValue;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  user?: { id: string; email: string; displayName?: string | null } | null;
  linkedRecommendationEvent?: {
    id: string;
    merchantNameInput?: string | null;
  } | null;
  linkedTransaction?: { id: string; rawMerchantName: string } | null;
  linkedOutcome?: { id: string; outcomeType: string } | null;
};

export type BetaCohort = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type BetaUserRow = {
  id: string;
  email: string;
  displayName?: string | null;
  betaProfile?: {
    status: "INVITED" | "ACTIVE" | "STUCK" | "CHURNED" | "PAUSED";
    notes?: string | null;
    tags: string[];
    cohort?: BetaCohort | null;
    firstRecommendationAt?: string | null;
    firstTransactionAuditAt?: string | null;
    firstPlaidSyncAt?: string | null;
  } | null;
  milestones: {
    recommendationCount: number;
    transactionAuditCount: number;
    feedbackCount: number;
    supportNoteCount: number;
    lastActiveAt?: string | null;
  };
  subscriptionStatus?: string | null;
  plaidStatusCounts: Record<string, number>;
};

export type SupportNote = {
  id: string;
  note: string;
  createdAt: string;
  adminUser?: { email: string; displayName?: string | null } | null;
};

export type ScheduledJobName =
  | "WEEKLY_AUDIT_EMAIL"
  | "REMINDER_DIGEST"
  | "ADMIN_ALERT"
  | "PLAID_SYNC_ALL"
  | "STATEMENT_CREDIT_USAGE_GENERATION"
  | "EVAL_KILL_TEST_SNAPSHOT";

export type ScheduledJobRun = {
  id: string;
  jobName: ScheduledJobName;
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";
  triggeredBy: "MANUAL" | "SCHEDULED" | "CLI";
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  idempotencyKey?: string | null;
  result?: JsonValue;
  errorMessage?: string | null;
  metadata?: JsonValue;
  createdAt: string;
};

export type AdminJobsStatus = {
  schedulerEnabled: boolean;
  registeredJobs: ScheduledJobName[];
  configuredSchedules: Array<{ jobName: ScheduledJobName; cron: string }>;
  runningJobs: ScheduledJobRun[];
  recentFailures: ScheduledJobRun[];
};

export type AdminOpsSummary = {
  generatedAt: string;
  recentJobFailures: number;
  recentEmailFailures: number;
  recentPlaidFailures: number;
  recentStripeWebhookFailures: number;
  recommendationErrorsLast7Days: number;
  openHighPriorityReviewTasks: number;
  usersCount: number;
  activeSubscriptionsCount: number;
  activePlaidConnectionsCount: number;
  latestJobFailures?: Array<{
    id: string;
    jobName: ScheduledJobName;
    startedAt: string;
    errorMessage?: string | null;
  }>;
};

export type AdminDiagnostics = {
  version: string;
  commitSha?: string | null;
  appEnv: string;
  nodeEnv: string;
  uptimeSeconds: number;
  database: "ok" | "error";
  schedulerEnabled: boolean;
  registeredJobs: ScheduledJobName[];
  runningJobCount: number;
  recentJobFailureCount: number;
  config: JsonValue;
};

export type BetaReadinessStatus = "READY" | "CAUTION" | "BLOCKED";

export type BetaReadinessCheck = {
  key: string;
  label: string;
  status: "PASS" | "WARN" | "FAIL";
  details?: string | null;
};

export type BetaReadiness = {
  generatedAt: string;
  status: BetaReadinessStatus;
  checks: BetaReadinessCheck[];
  config: {
    plaidConfigured: boolean;
    stripeConfigured: boolean;
    postmarkConfigured: boolean;
    sentryConfigured: boolean;
    schedulerEnabled: boolean;
  };
  operations: {
    databaseReady: boolean;
    recentJobFailures: number;
    recentEmailFailures: number;
    recentPlaidFailures: number;
    recentStripeWebhookFailures: number;
    openHighPriorityReviewTasks: number;
    unresolvedPrivacyRequests: number;
    recentAdminAuditLogCount: number;
    openFeedbackCount?: number;
    highCriticalFeedbackCount?: number;
    stuckBetaUsersCount?: number;
    usersWithNoRecommendation?: number;
    usersWithNoAuditedTransaction?: number;
    usersWithPlaidErrors?: number;
    supportNotesCount?: number;
    feedbackByType?: Record<string, number>;
  };
  productHealth: {
    usersCount: number;
    activeBetaUsersCount: number;
    activeSubscriptionsCount: number;
    recommendationErrorRateLast7Days: number;
    recommendationErrorRateLast30Days: number;
    killTest: {
      overallPass: boolean;
      usersEvaluated: number;
      meaningfulMissedValueCents: number;
      recommendationErrorRate: number;
      reasons: string[];
    } | null;
  };
  releaseChecklist: Array<{
    key: string;
    label: string;
    complete: boolean;
    status: "PASS" | "WARN" | "FAIL";
    details?: string | null;
  }>;
};

export type DashboardReviewWork = {
  openCorrections?: number;
  openReviewTasks?: number;
  highPriorityReviewTasks?: number;
  oldestOpenTaskCreatedAt?: string | null;
  tasksByType?: Record<string, number>;
  correctionsByType?: Record<string, number>;
};

export type RuleFreshnessDashboard = {
  staleDays: number;
  staleRules: unknown[];
  missingSourceRules: unknown[];
  lowConfidenceRules: unknown[];
};

export type RecommendationErrorsDashboard = {
  totalRecommendationErrors: number;
  errorRateAmongMatchedOutcomes: number;
  items: unknown[];
  groupedByMerchant: Array<{
    merchantName: string;
    count: number;
    missedValueCents?: number;
  }>;
};

export type KillTestResponse = {
  generatedAt: string;
  metrics: {
    passFail?: {
      overallPass: boolean;
      passesPrimaryKillTest?: boolean;
      passesTrustQualityGate?: boolean;
      passesDataCompletenessGate?: boolean;
      reasons: string[];
    };
    totalUsersEvaluated?: number;
    percentUsersWithMeaningfulMiss?: number;
    totalMeaningfulMissedValueCents?: number;
    recommendationErrorRate?: number;
    inconclusiveRate?: number;
    topMissMerchants?: Array<{
      merchantName: string;
      count: number;
      missedValueCents: number;
    }>;
    topMissCategories?: Array<{
      category: string;
      count: number;
      missedValueCents: number;
    }>;
  };
  users?: unknown[];
};
