import { prisma } from "@rewards-audit/db";

import { env, getSafeConfigSummary } from "../../config/env.js";
import { getSchedulerStatus } from "../jobs/scheduler.js";

export async function checkDatabase(): Promise<"ok" | "error"> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

export async function getReadiness() {
  const database = await checkDatabase();
  const envStatus = "ok" as const;
  return {
    status: database === "ok" && envStatus === "ok" ? "ready" : "not_ready",
    checks: {
      database,
      env: envStatus,
    },
    version: env.RELEASE_VERSION ?? "development",
    commitSha: env.COMMIT_SHA ?? null,
    uptimeSeconds: Math.round(process.uptime()),
  };
}

export async function getDiagnostics() {
  const [database, scheduler] = await Promise.all([
    checkDatabase(),
    getSchedulerStatus(),
  ]);
  return {
    version: env.RELEASE_VERSION ?? "development",
    commitSha: env.COMMIT_SHA ?? null,
    appEnv: env.APP_ENV,
    nodeEnv: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    database,
    schedulerEnabled: scheduler.schedulerEnabled,
    registeredJobs: scheduler.registeredJobs,
    configuredSchedules: scheduler.configuredSchedules,
    runningJobCount: scheduler.runningJobs.length,
    recentJobFailureCount: scheduler.recentFailures.length,
    config: getSafeConfigSummary(env),
  };
}

export async function getOpsSummary() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    recentJobFailures,
    recentEmailFailures,
    recentPlaidFailures,
    recentStripeWebhookFailures,
    recommendationErrors,
    highPriorityReviewTasks,
    usersCount,
    activeSubscriptionsCount,
    activePlaidConnectionsCount,
  ] = await Promise.all([
    prisma.scheduledJobRun.count({
      where: { status: "FAILED", startedAt: { gte: since24h } },
    }),
    prisma.emailLog.count({
      where: { status: "FAILED", createdAt: { gte: since24h } },
    }),
    prisma.plaidSyncRun.count({
      where: { status: "FAILED", startedAt: { gte: since24h } },
    }),
    prisma.stripeWebhookEvent.count({
      where: { status: "FAILED", createdAt: { gte: since24h } },
    }),
    prisma.recommendationOutcome.count({
      where: {
        outcomeType: "RECOMMENDATION_ERROR",
        computedAt: { gte: since7d },
      },
    }),
    prisma.curatorReviewTask.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, priority: "HIGH" },
    }),
    prisma.user.count(),
    prisma.subscription.count({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
    }),
    prisma.plaidConnection.count({ where: { status: "ACTIVE" } }),
  ]);

  const latestFailures = await prisma.scheduledJobRun.findMany({
    where: { status: "FAILED" },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: 5,
    select: {
      id: true,
      jobName: true,
      startedAt: true,
      errorMessage: true,
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    window: {
      recentFailuresSince: since24h.toISOString(),
      recommendationErrorsSince: since7d.toISOString(),
    },
    recentJobFailures,
    recentEmailFailures,
    recentPlaidFailures,
    recentStripeWebhookFailures,
    recommendationErrorsLast7Days: recommendationErrors,
    openHighPriorityReviewTasks: highPriorityReviewTasks,
    usersCount,
    activeSubscriptionsCount,
    activePlaidConnectionsCount,
    latestJobFailures: latestFailures.map((failure) => ({
      ...failure,
      errorMessage: failure.errorMessage,
    })),
  };
}
