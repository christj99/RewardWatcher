import { prisma } from "@rewards-audit/db";

import { env, getSafeConfigSummary } from "../config/env.js";
import { getOpenReviewWorkDashboard } from "./adminDataQualityService.js";
import { getKillTestEvaluation } from "./evalsService.js";
import { getSchedulerStatus } from "./jobs/scheduler.js";
import { checkDatabase, getOpsSummary } from "./observability/systemStatus.js";

type CheckStatus = "PASS" | "WARN" | "FAIL";

type ReadinessCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  details?: string | undefined;
};

export async function getBetaReadiness() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const safeConfig = getSafeConfigSummary(env);

  const [
    database,
    ops,
    scheduler,
    reviewWork,
    usersCount,
    activeBetaUsersCount,
    activeSubscriptionsCount,
    unresolvedPrivacyRequests,
    recentAdminAuditLogCount,
    recommendationErrors7d,
    matchedOutcomes7d,
    recommendationErrors30d,
    matchedOutcomes30d,
    openFeedbackCount,
    highCriticalFeedbackCount,
    feedbackByType,
    stuckBetaUsersCount,
    usersWithNoRecommendation,
    usersWithNoAuditedTransaction,
    usersWithPlaidErrors,
    supportNotesCount,
    latestKillTest,
  ] = await Promise.all([
    checkDatabase(),
    getOpsSummary(),
    getSchedulerStatus(),
    getOpenReviewWorkDashboard(),
    prisma.user.count(),
    prisma.user.count({ where: { plaidBetaEnabled: true } }),
    prisma.subscription.count({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
    }),
    prisma.privacyRequest.count({
      where: { status: { in: ["REQUESTED", "PROCESSING", "FAILED"] } },
    }),
    prisma.adminAuditLog.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.recommendationOutcome.count({
      where: {
        outcomeType: "RECOMMENDATION_ERROR",
        computedAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.recommendationOutcome.count({
      where: {
        recommendationEventId: { not: null },
        computedAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.recommendationOutcome.count({
      where: {
        outcomeType: "RECOMMENDATION_ERROR",
        computedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.recommendationOutcome.count({
      where: {
        recommendationEventId: { not: null },
        computedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.feedbackReport.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.feedbackReport.count({
      where: {
        status: { notIn: ["RESOLVED", "REJECTED"] },
        severity: { in: ["HIGH", "CRITICAL"] },
      },
    }),
    prisma.feedbackReport.groupBy({
      by: ["feedbackType"],
      where: { status: { notIn: ["RESOLVED", "REJECTED"] } },
      _count: { _all: true },
    }),
    prisma.userBetaProfile.count({ where: { status: "STUCK" } }),
    prisma.userBetaProfile.count({
      where: { firstRecommendationAt: null },
    }),
    prisma.userBetaProfile.count({
      where: { firstTransactionAuditAt: null },
    }),
    prisma.user.count({
      where: {
        plaidConnections: {
          some: { status: "ERROR" },
        },
      },
    }),
    prisma.supportNote.count(),
    getKillTestEvaluation({
      meaningfulMissThresholdCents: 100,
      annualSubscriptionPriceCents: 9900,
      primaryKillTestUserShare: 0.5,
      maxRecommendationErrorRate: 0.05,
      maxInconclusiveRate: 0.25,
    }).catch(() => null),
  ]);

  const recommendationErrorRateLast7Days = ratio(
    recommendationErrors7d,
    matchedOutcomes7d,
  );
  const recommendationErrorRateLast30Days = ratio(
    recommendationErrors30d,
    matchedOutcomes30d,
  );

  const checks: ReadinessCheck[] = [
    {
      key: "database",
      label: "Database readiness",
      status: database === "ok" ? "PASS" : "FAIL",
      details:
        database === "ok"
          ? "Database query succeeded."
          : "Database query failed.",
    },
    {
      key: "scheduler",
      label: "Scheduler decision",
      status: scheduler.schedulerEnabled ? "PASS" : "WARN",
      details: scheduler.schedulerEnabled
        ? "Scheduler is enabled for this environment."
        : "Scheduler is disabled; use manual jobs or enable it before launch.",
    },
    {
      key: "job_failures",
      label: "Recent job failures",
      status: ops.recentJobFailures === 0 ? "PASS" : "WARN",
      details: `${ops.recentJobFailures} failed job run(s) in the last 24 hours.`,
    },
    {
      key: "email_failures",
      label: "Recent email failures",
      status: ops.recentEmailFailures === 0 ? "PASS" : "WARN",
      details: `${ops.recentEmailFailures} failed email(s) in the last 24 hours.`,
    },
    {
      key: "review_tasks",
      label: "High priority review work",
      status: reviewWork.highPriorityReviewTasks === 0 ? "PASS" : "WARN",
      details: `${reviewWork.highPriorityReviewTasks} high-priority review task(s) are open.`,
    },
    {
      key: "privacy_requests",
      label: "Privacy requests",
      status: unresolvedPrivacyRequests === 0 ? "PASS" : "FAIL",
      details: `${unresolvedPrivacyRequests} unresolved privacy request(s).`,
    },
    {
      key: "feedback",
      label: "Open beta feedback",
      status:
        highCriticalFeedbackCount === 0
          ? openFeedbackCount > 0
            ? "WARN"
            : "PASS"
          : "FAIL",
      details: `${openFeedbackCount} open feedback report(s), ${highCriticalFeedbackCount} high/critical.`,
    },
    {
      key: "stuck_beta_users",
      label: "Stuck beta users",
      status: stuckBetaUsersCount === 0 ? "PASS" : "WARN",
      details: `${stuckBetaUsersCount} beta user(s) are marked stuck.`,
    },
    {
      key: "stripe",
      label: "Stripe configuration",
      status: safeConfig.stripeConfigured ? "PASS" : "WARN",
      details: safeConfig.stripeConfigured
        ? "Stripe appears configured."
        : "Stripe is not configured; paid checkout smoke will be limited.",
    },
    {
      key: "plaid",
      label: "Plaid configuration",
      status: safeConfig.plaidConfigured ? "PASS" : "WARN",
      details: safeConfig.plaidConfigured
        ? "Plaid appears configured."
        : "Plaid is not configured; sandbox sync smoke will be limited.",
    },
    {
      key: "email_provider",
      label: "Transactional email provider",
      status: safeConfig.emailProvider === "postmark" ? "PASS" : "WARN",
      details:
        safeConfig.emailProvider === "postmark"
          ? "Postmark is selected."
          : "Console email provider is selected.",
    },
    {
      key: "sentry",
      label: "Error reporting",
      status: safeConfig.sentryConfigured ? "PASS" : "WARN",
      details: safeConfig.sentryConfigured
        ? "Sentry is configured."
        : "Sentry is not configured.",
    },
  ];

  const releaseChecklist = checks.map((check) => ({
    key: check.key,
    label: check.label,
    complete: check.status === "PASS",
    status: check.status,
    details: check.details ?? null,
  }));

  return {
    generatedAt: now.toISOString(),
    status: checks.some((check) => check.status === "FAIL")
      ? "BLOCKED"
      : checks.some((check) => check.status === "WARN")
        ? "CAUTION"
        : "READY",
    checks,
    config: {
      plaidConfigured: Boolean(safeConfig.plaidConfigured),
      stripeConfigured: Boolean(safeConfig.stripeConfigured),
      postmarkConfigured: safeConfig.emailProvider === "postmark",
      sentryConfigured: Boolean(safeConfig.sentryConfigured),
      schedulerEnabled: scheduler.schedulerEnabled,
    },
    operations: {
      databaseReady: database === "ok",
      recentJobFailures: ops.recentJobFailures,
      recentEmailFailures: ops.recentEmailFailures,
      recentPlaidFailures: ops.recentPlaidFailures,
      recentStripeWebhookFailures: ops.recentStripeWebhookFailures,
      openHighPriorityReviewTasks: reviewWork.highPriorityReviewTasks,
      unresolvedPrivacyRequests,
      recentAdminAuditLogCount,
      openFeedbackCount,
      highCriticalFeedbackCount,
      feedbackByType: Object.fromEntries(
        feedbackByType.map((item) => [item.feedbackType, item._count._all]),
      ),
      stuckBetaUsersCount,
      usersWithNoRecommendation,
      usersWithNoAuditedTransaction,
      usersWithPlaidErrors,
      supportNotesCount,
    },
    productHealth: {
      usersCount,
      activeBetaUsersCount,
      activeSubscriptionsCount,
      recommendationErrorRateLast7Days,
      recommendationErrorRateLast30Days,
      killTest: latestKillTest
        ? {
            overallPass: latestKillTest.metrics.passFail?.overallPass ?? false,
            usersEvaluated: latestKillTest.metrics.totalUsersEvaluated ?? 0,
            meaningfulMissedValueCents:
              latestKillTest.metrics.totalMeaningfulMissedValueCents ?? 0,
            recommendationErrorRate:
              latestKillTest.metrics.recommendationErrorRate ?? 0,
            reasons: latestKillTest.metrics.passFail?.reasons ?? [],
          }
        : null,
    },
    releaseChecklist,
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
