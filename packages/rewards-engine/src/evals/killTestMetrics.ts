import type {
  KillTestComputationInput,
  KillTestMetrics,
  KillTestOutcomeDto,
  KillTestOutcomeType,
  KillTestReport,
  KillTestThresholds,
  UserKillTestSummary,
} from "./killTestTypes.js";

const DEFAULT_THRESHOLDS: KillTestThresholds = {
  primaryKillTestUserShare: 0.5,
  maxRecommendationErrorRate: 0.1,
  maxInconclusiveRate: 0.25,
};

const EMPTY_OUTCOME_COUNTS: Record<KillTestOutcomeType, number> = {
  CAPTURED_OPTIMAL: 0,
  USER_MISSED_VALUE: 0,
  RECOMMENDATION_ERROR: 0,
  UNMATCHED: 0,
  USER_OVERRIDE: 0,
  INCONCLUSIVE: 0,
};

export function calculateKillTestReport(
  input: KillTestComputationInput,
): KillTestReport {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const thresholds = {
    primaryKillTestUserShare:
      input.primaryKillTestUserShare ??
      DEFAULT_THRESHOLDS.primaryKillTestUserShare,
    maxRecommendationErrorRate:
      input.maxRecommendationErrorRate ??
      DEFAULT_THRESHOLDS.maxRecommendationErrorRate,
    maxInconclusiveRate:
      input.maxInconclusiveRate ?? DEFAULT_THRESHOLDS.maxInconclusiveRate,
  };
  const outcomes = input.outcomes.filter((outcome) =>
    inRange(outcomeDate(outcome), startDate, endDate),
  );
  const transactions = (input.transactions ?? []).filter((transaction) =>
    inRange(new Date(transaction.transactionDate), startDate, endDate),
  );
  const corrections = (input.corrections ?? []).filter((correction) =>
    inRange(new Date(correction.createdAt), startDate, endDate),
  );
  const userSummaries = buildUserSummaries({
    outcomes,
    transactions,
    corrections,
    meaningfulMissThresholdCents: input.meaningfulMissThresholdCents,
    annualSubscriptionPriceCents: input.annualSubscriptionPriceCents,
  });
  const meaningfulMisses = outcomes.filter((outcome) =>
    isMeaningfulMiss(outcome, input.meaningfulMissThresholdCents),
  );
  const totalUsersEvaluated = userSummaries.length;
  const totalOutcomes = outcomes.length;
  const totalMatchedRecommendations = outcomes.filter(
    (outcome) => outcome.recommendationEventId,
  ).length;
  const outcomeTypeCounts = outcomes.reduce(
    (counts, outcome) => {
      counts[outcome.outcomeType] += 1;
      return counts;
    },
    { ...EMPTY_OUTCOME_COUNTS },
  );
  const recommendationErrorCount = outcomeTypeCounts.RECOMMENDATION_ERROR;
  const inconclusiveCount = outcomeTypeCounts.INCONCLUSIVE;
  const userOverrideCount = outcomeTypeCounts.USER_OVERRIDE;
  const unmatchedOutcomeCount = outcomeTypeCounts.UNMATCHED;
  const correctionCount = corrections.length;
  const usersWithMeaningfulMiss = userSummaries.filter(
    (user) => user.hasMeaningfulMiss,
  ).length;
  const usersAboveSubscriptionValue = userSummaries.filter(
    (user) => user.aboveSubscriptionValue,
  ).length;
  const totalCapturedValueCents = sumNumbers(
    outcomes.map((outcome) => outcome.capturedValueCents),
  );
  const totalMissedValueCents = sumNumbers(
    outcomes.map((outcome) => outcome.missedValueCents),
  );
  const totalMeaningfulMissedValueCents = sumNumbers(
    meaningfulMisses.map((outcome) => outcome.missedValueCents),
  );
  const metricsBase = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    meaningfulMissThresholdCents: input.meaningfulMissThresholdCents,
    annualSubscriptionPriceCents: input.annualSubscriptionPriceCents,
    totalUsersEvaluated,
    totalTransactionsAudited: new Set(
      outcomes.map((outcome) => outcome.transaction.id),
    ).size,
    totalOutcomes,
    totalMatchedRecommendations,
    usersWithAnyOutcome: new Set(outcomes.map((outcome) => outcome.userId))
      .size,
    usersWithMeaningfulMiss,
    percentUsersWithMeaningfulMiss: percent(
      usersWithMeaningfulMiss,
      totalUsersEvaluated,
    ),
    usersAboveSubscriptionValue,
    percentUsersAboveSubscriptionValue: percent(
      usersAboveSubscriptionValue,
      totalUsersEvaluated,
    ),
    totalCapturedValueCents,
    totalMissedValueCents,
    totalMeaningfulMissedValueCents,
    averageMissedValuePerUserCents: average(
      totalMissedValueCents,
      totalUsersEvaluated,
    ),
    averageMeaningfulMissedValuePerUserCents: average(
      totalMeaningfulMissedValueCents,
      totalUsersEvaluated,
    ),
    medianMissedValuePerUserCents: median(
      userSummaries.map((user) => user.missedValueCents),
    ),
    medianMeaningfulMissedValuePerUserCents: median(
      userSummaries.map((user) => user.meaningfulMissedValueCents),
    ),
    recommendationErrorCount,
    recommendationErrorRate: ratio(
      recommendationErrorCount,
      totalMatchedRecommendations,
    ),
    inconclusiveCount,
    inconclusiveRate: ratio(inconclusiveCount, totalOutcomes),
    userOverrideCount,
    userOverrideRate: ratio(userOverrideCount, totalOutcomes),
    unmatchedOutcomeCount,
    unmatchedOutcomeRate: ratio(unmatchedOutcomeCount, totalOutcomes),
    correctionCount,
    correctionsPer100Outcomes: percent(correctionCount, totalOutcomes),
    outcomeTypeCounts,
    topMissCategories: groupedMisses(meaningfulMisses, (outcome) =>
      normalizeGroupKey(outcome.transaction.observedCategory, "UNKNOWN"),
    ).map(([category, value]) => ({
      category,
      count: value.count,
      missedValueCents: value.missedValueCents,
    })),
    topMissMerchants: groupedMisses(meaningfulMisses, (outcome) =>
      normalizeGroupKey(outcome.transaction.merchantName, "Unknown merchant"),
    ).map(([merchantName, value]) => ({
      merchantName,
      count: value.count,
      missedValueCents: value.missedValueCents,
    })),
    topRecommendationErrorMerchants: groupedRecommendationErrors(outcomes).map(
      ([merchantName, count]) => ({ merchantName, count }),
    ),
  };

  const metrics: KillTestMetrics = {
    ...metricsBase,
    passFail: evaluatePassFail(metricsBase, thresholds),
  };

  return {
    metrics,
    users: userSummaries.sort(sortUserSummaries),
  };
}

export function isMeaningfulMiss(
  outcome: KillTestOutcomeDto,
  thresholdCents: number,
): boolean {
  if (
    !["USER_MISSED_VALUE", "RECOMMENDATION_ERROR", "UNMATCHED"].includes(
      outcome.outcomeType,
    )
  ) {
    return false;
  }

  return numberValue(outcome.missedValueCents) >= thresholdCents;
}

function buildUserSummaries(input: {
  outcomes: KillTestOutcomeDto[];
  transactions: Array<{
    id: string;
    userId: string;
    userEmail?: string | null | undefined;
  }>;
  corrections: Array<{ userId: string }>;
  meaningfulMissThresholdCents: number;
  annualSubscriptionPriceCents: number;
}): UserKillTestSummary[] {
  const users = new Map<string, UserKillTestSummary>();
  const transactionIdsByUser = new Map<string, Set<string>>();

  for (const transaction of input.transactions) {
    ensureUser(users, transaction.userId, transaction.userEmail);
    addTransactionForUser(
      transactionIdsByUser,
      transaction.userId,
      transaction.id,
    );
  }

  for (const outcome of input.outcomes) {
    const user = ensureUser(users, outcome.userId, outcome.userEmail);
    user.outcomeCount += 1;
    addTransactionForUser(
      transactionIdsByUser,
      outcome.userId,
      outcome.transaction.id,
    );
    user.capturedValueCents += numberValue(outcome.capturedValueCents);
    user.missedValueCents += numberValue(outcome.missedValueCents);

    if (isMeaningfulMiss(outcome, input.meaningfulMissThresholdCents)) {
      user.meaningfulMissCount += 1;
      user.meaningfulMissedValueCents += numberValue(outcome.missedValueCents);
    }

    if (outcome.outcomeType === "RECOMMENDATION_ERROR") {
      user.recommendationErrorCount += 1;
    }

    if (outcome.outcomeType === "INCONCLUSIVE") {
      user.inconclusiveCount += 1;
    }

    if (outcome.outcomeType === "USER_OVERRIDE") {
      user.userOverrideCount += 1;
    }
  }

  for (const correction of input.corrections) {
    const user = users.get(correction.userId);
    if (user) {
      user.correctionCount += 1;
    }
  }

  for (const user of users.values()) {
    user.transactionCount = transactionIdsByUser.get(user.userId)?.size ?? 0;
    user.hasMeaningfulMiss =
      user.meaningfulMissedValueCents >= input.meaningfulMissThresholdCents ||
      user.meaningfulMissCount > 0;
    user.aboveSubscriptionValue =
      user.meaningfulMissedValueCents >= input.annualSubscriptionPriceCents;
  }

  return [...users.values()];
}

function addTransactionForUser(
  transactionIdsByUser: Map<string, Set<string>>,
  userId: string,
  transactionId: string,
): void {
  const transactionIds = transactionIdsByUser.get(userId) ?? new Set<string>();
  transactionIds.add(transactionId);
  transactionIdsByUser.set(userId, transactionIds);
}

function ensureUser(
  users: Map<string, UserKillTestSummary>,
  userId: string,
  email?: string | null,
): UserKillTestSummary {
  const existing = users.get(userId);

  if (existing) {
    if (!existing.email && email) {
      existing.email = email;
    }
    return existing;
  }

  const created: UserKillTestSummary = {
    userId,
    ...(email ? { email } : {}),
    transactionCount: 0,
    outcomeCount: 0,
    capturedValueCents: 0,
    missedValueCents: 0,
    meaningfulMissedValueCents: 0,
    meaningfulMissCount: 0,
    recommendationErrorCount: 0,
    inconclusiveCount: 0,
    userOverrideCount: 0,
    correctionCount: 0,
    aboveSubscriptionValue: false,
    hasMeaningfulMiss: false,
  };
  users.set(userId, created);
  return created;
}

function evaluatePassFail(
  metrics: Omit<KillTestMetrics, "passFail">,
  thresholds: KillTestThresholds,
): KillTestMetrics["passFail"] {
  const reasons: string[] = [];
  const targetPercent = thresholds.primaryKillTestUserShare * 100;
  const passesPrimaryKillTest =
    metrics.percentUsersWithMeaningfulMiss >= targetPercent ||
    (metrics.totalUsersEvaluated > 0 &&
      metrics.totalUsersEvaluated < 5 &&
      metrics.usersAboveSubscriptionValue >= 1);

  if (!passesPrimaryKillTest) {
    reasons.push(
      `Only ${formatPercent(metrics.percentUsersWithMeaningfulMiss)} of users had a meaningful miss; target is ${formatPercent(targetPercent)}.`,
    );
  }

  if (metrics.totalMatchedRecommendations < 10) {
    reasons.push(
      `Sample size is small: only ${metrics.totalMatchedRecommendations} matched recommendations.`,
    );
  }

  const trustClearlyFails =
    metrics.totalMatchedRecommendations >= 10 &&
    metrics.recommendationErrorRate > thresholds.maxRecommendationErrorRate;
  const passesTrustQualityGate = !trustClearlyFails;

  if (trustClearlyFails) {
    reasons.push(
      `Recommendation error rate was ${formatPercent(
        metrics.recommendationErrorRate * 100,
      )}, above the ${formatPercent(
        thresholds.maxRecommendationErrorRate * 100,
      )} trust threshold.`,
    );
  }

  if (metrics.totalOutcomes < 10) {
    reasons.push(
      `Sample size is small: only ${metrics.totalOutcomes} outcomes.`,
    );
  }

  const dataClearlyFails =
    metrics.totalOutcomes >= 10 &&
    metrics.inconclusiveRate > thresholds.maxInconclusiveRate;
  const passesDataCompletenessGate = !dataClearlyFails;

  if (dataClearlyFails) {
    reasons.push(
      `Inconclusive rate was ${formatPercent(
        metrics.inconclusiveRate * 100,
      )}, above the ${formatPercent(
        thresholds.maxInconclusiveRate * 100,
      )} data completeness threshold.`,
    );
  }

  if (reasons.length === 0) {
    reasons.push("Kill-test gates passed for this evaluation window.");
  }

  return {
    passesPrimaryKillTest,
    passesTrustQualityGate,
    passesDataCompletenessGate,
    overallPass:
      passesPrimaryKillTest &&
      passesTrustQualityGate &&
      passesDataCompletenessGate,
    reasons,
  };
}

function groupedMisses(
  outcomes: KillTestOutcomeDto[],
  keyForOutcome: (outcome: KillTestOutcomeDto) => string,
) {
  const groups = new Map<string, { count: number; missedValueCents: number }>();

  for (const outcome of outcomes) {
    const key = keyForOutcome(outcome);
    const group = groups.get(key) ?? { count: 0, missedValueCents: 0 };
    group.count += 1;
    group.missedValueCents += numberValue(outcome.missedValueCents);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .sort(
      ([leftKey, left], [rightKey, right]) =>
        right.missedValueCents - left.missedValueCents ||
        right.count - left.count ||
        leftKey.localeCompare(rightKey),
    )
    .slice(0, 10);
}

function groupedRecommendationErrors(outcomes: KillTestOutcomeDto[]) {
  const groups = new Map<string, number>();

  for (const outcome of outcomes) {
    if (outcome.outcomeType !== "RECOMMENDATION_ERROR") {
      continue;
    }
    const merchantName = normalizeGroupKey(
      outcome.transaction.merchantName,
      "Unknown merchant",
    );
    groups.set(merchantName, (groups.get(merchantName) ?? 0) + 1);
  }

  return [...groups.entries()]
    .sort(
      ([leftKey, leftCount], [rightKey, rightCount]) =>
        rightCount - leftCount || leftKey.localeCompare(rightKey),
    )
    .slice(0, 10);
}

function sortUserSummaries(
  left: UserKillTestSummary,
  right: UserKillTestSummary,
): number {
  return (
    right.meaningfulMissedValueCents - left.meaningfulMissedValueCents ||
    right.missedValueCents - left.missedValueCents ||
    (left.email ?? left.userId).localeCompare(right.email ?? right.userId)
  );
}

function outcomeDate(outcome: KillTestOutcomeDto): Date {
  return new Date(
    outcome.transaction.transactionDate ??
      outcome.computedAt ??
      outcome.createdAt ??
      0,
  );
}

function inRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date < endDate;
}

function sumNumbers(values: Array<number | string | null | undefined>): number {
  return values.reduce<number>((sum, value) => sum + numberValue(value), 0);
}

function numberValue(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Math.round(Number(value));
}

function average(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function percent(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function normalizeGroupKey(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
