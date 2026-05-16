import type { Prisma } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

export async function getRuleFreshnessDashboard(input: {
  staleDays: number;
  limit: number;
}) {
  const staleBefore = new Date();
  staleBefore.setDate(staleBefore.getDate() - input.staleDays);
  const include = {
    card: { include: { issuer: true } },
    merchant: true,
    source: true,
  } satisfies Prisma.EarningRuleInclude;
  const [staleRules, missingSourceRules, lowConfidenceRules] =
    await Promise.all([
      prisma.earningRule.findMany({
        where: {
          OR: [
            { source: null },
            { source: { verifiedAt: null } },
            { source: { verifiedAt: { lt: staleBefore } } },
          ],
        },
        include,
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: input.limit,
      }),
      prisma.earningRule.findMany({
        where: { sourceId: null },
        include,
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: input.limit,
      }),
      prisma.earningRule.findMany({
        where: { confidence: { in: ["LOW", "UNKNOWN"] } },
        include,
        orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        take: input.limit,
      }),
    ]);

  return {
    staleDays: input.staleDays,
    staleRules: staleRules.map((rule) => mapFreshnessRule(rule, staleBefore)),
    missingSourceRules: missingSourceRules.map((rule) =>
      mapFreshnessRule(rule, staleBefore),
    ),
    lowConfidenceRules: lowConfidenceRules.map((rule) =>
      mapFreshnessRule(rule, staleBefore),
    ),
  };
}

export async function getRecommendationErrorsDashboard(input: {
  startDate?: string | undefined;
  endDate?: string | undefined;
  limit: number;
}) {
  const { startDate, endDate } = resolveRange(input.startDate, input.endDate);
  const whereBase = {
    transaction: {
      transactionDate: {
        gte: startDate,
        lt: endDate,
      },
    },
  } satisfies Prisma.RecommendationOutcomeWhereInput;
  const [errors, matchedCount] = await Promise.all([
    prisma.recommendationOutcome.findMany({
      where: { ...whereBase, outcomeType: "RECOMMENDATION_ERROR" },
      include: {
        transaction: { include: { merchant: true } },
        recommendationEvent: { include: { recommendedCard: true } },
        recommendedUserCard: { include: { card: true } },
        bestUserCard: { include: { card: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: input.limit,
    }),
    prisma.recommendationOutcome.count({
      where: { ...whereBase, recommendationEventId: { not: null } },
    }),
  ]);
  const grouped = new Map<
    string,
    { count: number; missedValueCents: number }
  >();

  for (const error of errors) {
    const merchantName =
      error.transaction.merchant?.name ??
      error.transaction.normalizedMerchantName ??
      error.transaction.rawMerchantName ??
      "Unknown merchant";
    const group = grouped.get(merchantName) ?? {
      count: 0,
      missedValueCents: 0,
    };
    group.count += 1;
    group.missedValueCents += decimalToNumber(error.missedValueCents);
    grouped.set(merchantName, group);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    totalRecommendationErrors: errors.length,
    errorRateAmongMatchedOutcomes:
      matchedCount === 0 ? 0 : errors.length / matchedCount,
    items: errors.map((error) => ({
      outcomeId: error.id,
      transaction: error.transaction,
      recommendationEvent: error.recommendationEvent,
      merchant: error.transaction.merchant,
      recommendedCard:
        error.recommendedUserCard?.card ??
        error.recommendationEvent?.recommendedCard ??
        null,
      bestCard: error.bestUserCard?.card ?? null,
      missedValueCents: decimalToNumber(error.missedValueCents),
      confidence: error.confidence,
      explanation: error.explanation,
      createdAt: error.createdAt,
    })),
    groupedByMerchant: [...grouped.entries()]
      .map(([merchantName, value]) => ({ merchantName, ...value }))
      .sort(
        (left, right) =>
          right.count - left.count ||
          right.missedValueCents - left.missedValueCents ||
          left.merchantName.localeCompare(right.merchantName),
      ),
  };
}

export async function getOpenReviewWorkDashboard() {
  const [
    openCorrections,
    openReviewTasks,
    highPriorityReviewTasks,
    oldestOpenTask,
    tasksByType,
    correctionsByType,
  ] = await Promise.all([
    prisma.recommendationCorrection.count({
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
    }),
    prisma.curatorReviewTask.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.curatorReviewTask.count({
      where: { priority: "HIGH", status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.curatorReviewTask.findFirst({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: [{ createdAt: "asc" }],
      select: { createdAt: true },
    }),
    prisma.curatorReviewTask.groupBy({
      by: ["taskType"],
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      _count: { _all: true },
    }),
    prisma.recommendationCorrection.groupBy({
      by: ["correctionType"],
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      _count: { _all: true },
    }),
  ]);

  return {
    openCorrections,
    openReviewTasks,
    highPriorityReviewTasks,
    oldestOpenTaskCreatedAt: oldestOpenTask?.createdAt ?? null,
    tasksByType: Object.fromEntries(
      tasksByType.map((item) => [item.taskType, item._count._all]),
    ),
    correctionsByType: Object.fromEntries(
      correctionsByType.map((item) => [item.correctionType, item._count._all]),
    ),
  };
}

type FreshnessRule = Prisma.EarningRuleGetPayload<{
  include: {
    card: { include: { issuer: true } };
    merchant: true;
    source: true;
  };
}>;

function mapFreshnessRule(rule: FreshnessRule, staleBefore: Date) {
  const verifiedAt = rule.source?.verifiedAt ?? null;
  return {
    earningRuleId: rule.id,
    card: rule.card,
    category: rule.category,
    merchant: rule.merchant,
    confidence: rule.confidence,
    source: rule.source,
    sourceVerifiedAt: verifiedAt,
    ageDays: verifiedAt
      ? Math.floor((Date.now() - verifiedAt.getTime()) / 86_400_000)
      : null,
    isStale: !verifiedAt || verifiedAt < staleBefore,
    notes: rule.notes,
  };
}

function resolveRange(
  startDateInput?: string,
  endDateInput?: string,
): { startDate: Date; endDate: Date } {
  if (startDateInput && endDateInput) {
    return {
      startDate: new Date(startDateInput),
      endDate: new Date(endDateInput),
    };
  }

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 30);
  return { startDate, endDate };
}

function decimalToNumber(value: Prisma.Decimal | null): number {
  return value === null ? 0 : Number(value.toString());
}
