import {
  ConsentType,
  EntitlementKey,
  ScheduledJobName,
  type User,
} from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { hasActiveConsent } from "../consentService.js";
import { hasEntitlement } from "../entitlementService.js";
import { getKillTestEvaluation } from "../evalsService.js";
import { sendAdminAlertEmails } from "../notifications/adminAlertJob.js";
import { sendReminderDigestEmails } from "../notifications/reminderDigestJob.js";
import { sendWeeklyAuditEmails } from "../notifications/weeklyAuditEmailJob.js";
import { syncAllPlaidConnections } from "../plaidService.js";
import { generateStatementCreditUsage } from "../statementCreditUsageService.js";
import type { JobInput, JobResult, RegisteredJob } from "./jobTypes.js";

export const registeredJobs: Record<ScheduledJobName, RegisteredJob> = {
  [ScheduledJobName.WEEKLY_AUDIT_EMAIL]: {
    name: ScheduledJobName.WEEKLY_AUDIT_EMAIL,
    run: runWeeklyAuditEmailJob,
  },
  [ScheduledJobName.REMINDER_DIGEST]: {
    name: ScheduledJobName.REMINDER_DIGEST,
    run: runReminderDigestJob,
  },
  [ScheduledJobName.ADMIN_ALERT]: {
    name: ScheduledJobName.ADMIN_ALERT,
    run: runAdminAlertJob,
  },
  [ScheduledJobName.PLAID_SYNC_ALL]: {
    name: ScheduledJobName.PLAID_SYNC_ALL,
    run: runPlaidSyncAllJob,
  },
  [ScheduledJobName.STATEMENT_CREDIT_USAGE_GENERATION]: {
    name: ScheduledJobName.STATEMENT_CREDIT_USAGE_GENERATION,
    run: runStatementCreditUsageJob,
  },
  [ScheduledJobName.EVAL_KILL_TEST_SNAPSHOT]: {
    name: ScheduledJobName.EVAL_KILL_TEST_SNAPSHOT,
    run: runEvalKillTestSnapshotJob,
  },
};

export function getRegisteredJob(jobName: ScheduledJobName): RegisteredJob {
  return registeredJobs[jobName];
}

export function listRegisteredJobs(): ScheduledJobName[] {
  return Object.values(ScheduledJobName);
}

async function runWeeklyAuditEmailJob(input: JobInput): Promise<JobResult> {
  const result = await sendWeeklyAuditEmails({
    startDate: stringOrUndefined(input.startDate),
    endDate: stringOrUndefined(input.endDate),
    userId: stringOrUndefined(input.userId),
    dryRun: booleanOrUndefined(input.dryRun),
  });
  return { status: "SUCCEEDED", summary: result };
}

async function runReminderDigestJob(input: JobInput): Promise<JobResult> {
  const nowInput = stringOrUndefined(input.now);
  const result = await sendReminderDigestEmails({
    now: nowInput ? new Date(nowInput) : undefined,
    lookaheadDays: numberOrUndefined(input.lookaheadDays),
    userId: stringOrUndefined(input.userId),
    dryRun: booleanOrUndefined(input.dryRun),
  });
  return { status: "SUCCEEDED", summary: result };
}

async function runAdminAlertJob(input: JobInput): Promise<JobResult> {
  const result = await sendAdminAlertEmails({
    dryRun: booleanOrUndefined(input.dryRun),
    toEmails: stringArrayOrUndefined(input.toEmails),
  });
  return { status: "SUCCEEDED", summary: result };
}

async function runPlaidSyncAllJob(input: JobInput): Promise<JobResult> {
  const users = await eligiblePlaidUsers(stringOrUndefined(input.userId));
  const dryRun = booleanOrUndefined(input.dryRun) ?? false;
  const audit = booleanOrUndefined(input.audit) ?? true;
  let syncedUserCount = 0;
  let skippedUserCount = 0;
  let importedTransactionCount = 0;
  let auditedTransactionCount = 0;

  for (const user of users) {
    if (dryRun) {
      skippedUserCount += 1;
      continue;
    }
    const result = await syncAllPlaidConnections(user, { audit });
    syncedUserCount += 1;
    importedTransactionCount += result.importedTransactionCount;
    auditedTransactionCount += result.auditedTransactionCount;
  }

  return {
    status: "SUCCEEDED",
    summary: {
      candidateUserCount: users.length,
      syncedUserCount,
      skippedUserCount,
      importedTransactionCount,
      auditedTransactionCount,
      dryRun,
    },
  };
}

async function runStatementCreditUsageJob(input: JobInput): Promise<JobResult> {
  const users = await eligibleStatementCreditUsers(
    stringOrUndefined(input.userId),
  );
  const dryRun = booleanOrUndefined(input.dryRun) ?? false;
  let generatedCount = 0;
  let updatedCount = 0;

  if (!dryRun) {
    for (const user of users) {
      const result = await generateStatementCreditUsage(user, {
        inferFromTransactions:
          booleanOrUndefined(input.inferFromTransactions) ?? true,
        userCardId: stringOrUndefined(input.userCardId),
        periodStart: stringOrUndefined(input.periodStart),
        periodEnd: stringOrUndefined(input.periodEnd),
      });
      generatedCount += result.generatedCount;
      updatedCount += result.updatedCount;
    }
  }

  return {
    status: "SUCCEEDED",
    summary: {
      candidateUserCount: users.length,
      generatedCount,
      updatedCount,
      dryRun,
    },
  };
}

async function runEvalKillTestSnapshotJob(input: JobInput): Promise<JobResult> {
  const report = await getKillTestEvaluation({
    startDate: stringOrUndefined(input.startDate),
    endDate: stringOrUndefined(input.endDate),
    meaningfulMissThresholdCents:
      numberOrUndefined(input.meaningfulMissThresholdCents) ?? 100,
    annualSubscriptionPriceCents:
      numberOrUndefined(input.annualSubscriptionPriceCents) ?? 9900,
    primaryKillTestUserShare:
      numberOrUndefined(input.primaryKillTestUserShare) ?? 0.5,
    maxRecommendationErrorRate:
      numberOrUndefined(input.maxRecommendationErrorRate) ?? 0.05,
    maxInconclusiveRate: numberOrUndefined(input.maxInconclusiveRate) ?? 0.25,
  });
  return {
    status: "SUCCEEDED",
    summary: {
      generatedAt: report.generatedAt,
      overallPass: report.metrics.passFail.overallPass,
      usersEvaluated: report.metrics.totalUsersEvaluated,
      recommendationErrorRate: report.metrics.recommendationErrorRate,
      inconclusiveRate: report.metrics.inconclusiveRate,
      meaningfulMissUserShare: report.metrics.percentUsersWithMeaningfulMiss,
      totalMeaningfulMissedValueCents:
        report.metrics.totalMeaningfulMissedValueCents,
      reasons: report.metrics.passFail.reasons,
    },
  };
}

async function eligiblePlaidUsers(userId?: string): Promise<User[]> {
  const users = await prisma.user.findMany({
    where: {
      ...(userId ? { id: userId } : {}),
      plaidBetaEnabled: true,
      email: { not: { contains: "@deleted.local" } },
      plaidConnections: { some: { status: "ACTIVE" } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const eligible: User[] = [];
  for (const user of users) {
    const [hasSync, hasConsent] = await Promise.all([
      hasEntitlement(user.id, EntitlementKey.PLAID_SYNC),
      hasActiveConsent(user.id, ConsentType.PLAID_TRANSACTIONS),
    ]);
    if (hasSync && hasConsent) {
      eligible.push(user);
    }
  }
  return eligible;
}

async function eligibleStatementCreditUsers(userId?: string): Promise<User[]> {
  const users = await prisma.user.findMany({
    where: {
      ...(userId ? { id: userId } : {}),
      email: { not: { contains: "@deleted.local" } },
      userCards: {
        some: {
          isActive: true,
          card: { statementCredits: { some: {} } },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const eligible: User[] = [];
  for (const user of users) {
    if (
      await hasEntitlement(user.id, EntitlementKey.STATEMENT_CREDIT_TRACKING)
    ) {
      eligible.push(user);
    }
  }
  return eligible;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function stringArrayOrUndefined(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
  return values.length ? values : undefined;
}
