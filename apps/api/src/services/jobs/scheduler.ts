import {
  ScheduledJobName,
  ScheduledJobTrigger,
  type ScheduledJobRun,
} from "@prisma/client";

import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { redactSensitive } from "../../lib/redaction.js";
import { runScheduledJob } from "./jobRunner.js";
import { listRegisteredJobs } from "./jobRegistry.js";

export type JobScheduleConfig = {
  jobName: ScheduledJobName;
  cron: string;
};

export type SchedulerController = {
  enabled: boolean;
  schedules: JobScheduleConfig[];
  stop: () => void;
};

export function getConfiguredJobSchedules(): JobScheduleConfig[] {
  return [
    {
      jobName: ScheduledJobName.WEEKLY_AUDIT_EMAIL,
      cron: env.SCHEDULE_WEEKLY_AUDIT_EMAIL_CRON,
    },
    {
      jobName: ScheduledJobName.REMINDER_DIGEST,
      cron: env.SCHEDULE_REMINDER_DIGEST_CRON,
    },
    {
      jobName: ScheduledJobName.ADMIN_ALERT,
      cron: env.SCHEDULE_ADMIN_ALERT_CRON,
    },
    {
      jobName: ScheduledJobName.PLAID_SYNC_ALL,
      cron: env.SCHEDULE_PLAID_SYNC_ALL_CRON ?? "",
    },
    {
      jobName: ScheduledJobName.STATEMENT_CREDIT_USAGE_GENERATION,
      cron: env.SCHEDULE_STATEMENT_CREDIT_USAGE_CRON,
    },
    {
      jobName: ScheduledJobName.EVAL_KILL_TEST_SNAPSHOT,
      cron: env.SCHEDULE_EVAL_KILL_TEST_CRON ?? "",
    },
  ].filter((schedule) => schedule.cron.trim().length > 0);
}

export function createScheduler(): SchedulerController {
  const schedules = getConfiguredJobSchedules();
  if (!env.SCHEDULER_ENABLED) {
    return { enabled: false, schedules, stop: () => undefined };
  }

  let lastMinuteKey = "";
  const timer = setInterval(() => {
    const now = new Date();
    const minuteKey = now.toISOString().slice(0, 16);
    if (minuteKey === lastMinuteKey) return;
    lastMinuteKey = minuteKey;

    for (const schedule of schedules) {
      if (!cronMatches(schedule.cron, now)) continue;
      void runScheduledJob({
        jobName: schedule.jobName,
        trigger: ScheduledJobTrigger.SCHEDULED,
        input: defaultInputFor(schedule.jobName, now),
        idempotencyKey: `scheduled:${schedule.jobName}:${minuteKey}`,
        requestedByUserId: env.SCHEDULER_INSTANCE_ID ?? "scheduler",
      });
    }
  }, 30_000);

  logger.info("Scheduler enabled", {
    schedules: redactSensitive(schedules),
    registeredJobs: listRegisteredJobs(),
    instanceId: env.SCHEDULER_INSTANCE_ID ?? null,
    timezone: env.SCHEDULER_TIMEZONE,
  });

  return {
    enabled: true,
    schedules,
    stop: () => clearInterval(timer),
  };
}

export async function getSchedulerStatus(): Promise<{
  schedulerEnabled: boolean;
  registeredJobs: ScheduledJobName[];
  configuredSchedules: JobScheduleConfig[];
  runningJobs: ScheduledJobRun[];
  recentFailures: ScheduledJobRun[];
}> {
  const { prisma } = await import("@rewards-audit/db");
  const [runningJobs, recentFailures] = await Promise.all([
    prisma.scheduledJobRun.findMany({
      where: { status: "RUNNING" },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: 20,
    }),
    prisma.scheduledJobRun.findMany({
      where: { status: "FAILED" },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: 10,
    }),
  ]);
  return {
    schedulerEnabled: env.SCHEDULER_ENABLED,
    registeredJobs: listRegisteredJobs(),
    configuredSchedules: getConfiguredJobSchedules(),
    runningJobs,
    recentFailures,
  };
}

function cronMatches(cron: string, now: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return (
    fieldMatches(minute, now.getUTCMinutes()) &&
    fieldMatches(hour, now.getUTCHours()) &&
    fieldMatches(dayOfMonth, now.getUTCDate()) &&
    fieldMatches(month, now.getUTCMonth() + 1) &&
    fieldMatches(dayOfWeek, now.getUTCDay())
  );
}

function fieldMatches(field: string | undefined, value: number): boolean {
  if (!field || field === "*") return true;
  return field.split(",").some((part) => Number(part) === value);
}

function defaultInputFor(
  jobName: ScheduledJobName,
  now: Date,
): Record<string, unknown> {
  if (jobName === ScheduledJobName.WEEKLY_AUDIT_EMAIL) {
    const endDate = now.toISOString();
    const startDate = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    return { startDate, endDate };
  }
  if (jobName === ScheduledJobName.REMINDER_DIGEST) {
    return { now: now.toISOString(), lookaheadDays: 7 };
  }
  if (jobName === ScheduledJobName.PLAID_SYNC_ALL) {
    return { audit: true };
  }
  if (jobName === ScheduledJobName.STATEMENT_CREDIT_USAGE_GENERATION) {
    return { inferFromTransactions: true };
  }
  return {};
}
