import {
  ScheduledJobStatus,
  type Prisma,
  type ScheduledJobName,
  type ScheduledJobRun,
  type ScheduledJobTrigger,
} from "@prisma/client";
import crypto from "node:crypto";

import { prisma } from "@rewards-audit/db";

import { badRequest } from "../../lib/httpErrors.js";
import { redactSensitive } from "../../lib/redaction.js";
import { captureException } from "../observability/errorReporter.js";
import { acquireJobLock, releaseJobLock } from "./jobLocks.js";
import { getRegisteredJob } from "./jobRegistry.js";
import type { RunScheduledJobInput } from "./jobTypes.js";

const defaultLockTtlMs = 15 * 60 * 1000;

export async function runScheduledJob(
  input: RunScheduledJobInput,
): Promise<ScheduledJobRun> {
  const job = getRegisteredJob(input.jobName);
  if (!job) {
    throw badRequest(`Unknown scheduled job: ${input.jobName}`);
  }

  if (input.idempotencyKey) {
    const existing = await prisma.scheduledJobRun.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  const startedAt = new Date();
  const lockedBy =
    input.requestedByUserId ??
    `runner-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
  const metadata = toJson({
    input: input.input ?? {},
    requestedByUserId: input.requestedByUserId,
  });
  const lock = await acquireJobLock({
    jobName: input.jobName,
    lockedBy,
    ttlMs: input.lockTtlMs ?? defaultLockTtlMs,
    metadata,
  });

  if (!lock) {
    return createSkippedRun(
      input,
      startedAt,
      "A run for this job is already active.",
    );
  }

  const runData: Prisma.ScheduledJobRunUncheckedCreateInput = {
    jobName: input.jobName,
    status: ScheduledJobStatus.RUNNING,
    triggeredBy: input.trigger,
    startedAt,
    metadata,
  };
  if (input.idempotencyKey !== undefined) {
    runData.idempotencyKey = input.idempotencyKey;
  }
  const run = await prisma.scheduledJobRun.create({
    data: runData,
  });

  try {
    const result = await job.run(input.input ?? {});
    const finishedAt = new Date();
    return await prisma.scheduledJobRun.update({
      where: { id: run.id },
      data: {
        status:
          result.status === "SKIPPED"
            ? ScheduledJobStatus.SKIPPED
            : ScheduledJobStatus.SUCCEEDED,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        result: toJson(result.summary),
      },
    });
  } catch (error) {
    captureException(error, {
      jobName: input.jobName,
      trigger: input.trigger,
      idempotencyKey: input.idempotencyKey,
      input: input.input ?? {},
    });
    const finishedAt = new Date();
    return await prisma.scheduledJobRun.update({
      where: { id: run.id },
      data: {
        status: ScheduledJobStatus.FAILED,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        errorMessage: sanitizeErrorMessage(error),
      },
    });
  } finally {
    await releaseJobLock(lock);
  }
}

export async function listScheduledJobRuns(input: {
  jobName?: ScheduledJobName | undefined;
  status?: ScheduledJobStatus | undefined;
  trigger?: ScheduledJobTrigger | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  limit: number;
}) {
  return prisma.scheduledJobRun.findMany({
    where: {
      ...(input.jobName ? { jobName: input.jobName } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.trigger ? { triggeredBy: input.trigger } : {}),
      ...(input.startDate || input.endDate
        ? {
            startedAt: {
              ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
              ...(input.endDate ? { lt: new Date(input.endDate) } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

export async function getScheduledJobRun(id: string) {
  return prisma.scheduledJobRun.findUnique({ where: { id } });
}

async function createSkippedRun(
  input: RunScheduledJobInput,
  startedAt: Date,
  reason: string,
): Promise<ScheduledJobRun> {
  const finishedAt = new Date();
  const data: Prisma.ScheduledJobRunUncheckedCreateInput = {
    jobName: input.jobName,
    status: ScheduledJobStatus.SKIPPED,
    triggeredBy: input.trigger,
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    result: toJson({ reason }),
    metadata: toJson({
      input: input.input ?? {},
      requestedByUserId: input.requestedByUserId,
    }),
  };
  if (input.idempotencyKey !== undefined) {
    data.idempotencyKey = input.idempotencyKey;
  }
  return prisma.scheduledJobRun.create({ data });
}

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return String(redactSensitive(error.message));
  }
  return String(redactSensitive(error));
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitive(value) as Prisma.InputJsonValue;
}
