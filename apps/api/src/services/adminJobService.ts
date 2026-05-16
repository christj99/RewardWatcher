import {
  ScheduledJobTrigger,
  type ScheduledJobName,
  type ScheduledJobStatus,
  type User,
} from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { notFound } from "../lib/httpErrors.js";
import {
  getScheduledJobRun,
  listScheduledJobRuns,
  runScheduledJob,
} from "./jobs/jobRunner.js";
import { listRegisteredJobs } from "./jobs/jobRegistry.js";
import { getSchedulerStatus } from "./jobs/scheduler.js";
import { recordAdminAuditLog } from "./adminAuditLogService.js";

export async function listAdminJobRuns(input: {
  jobName?: ScheduledJobName | undefined;
  status?: ScheduledJobStatus | undefined;
  trigger?: ScheduledJobTrigger | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  limit: number;
}) {
  return listScheduledJobRuns(input);
}

export async function getAdminJobRun(id: string) {
  const run = await getScheduledJobRun(id);
  if (!run) throw notFound("Scheduled job run not found.");
  return run;
}

export async function runAdminJob(
  admin: User,
  request: FastifyRequest,
  body: {
    jobName: Parameters<typeof runScheduledJob>[0]["jobName"];
    input?: Record<string, unknown> | undefined;
    dryRun?: boolean | undefined;
    idempotencyKey?: string | undefined;
  },
) {
  const input = { ...(body.input ?? {}) };
  if (body.dryRun !== undefined) input.dryRun = body.dryRun;
  const run = await runScheduledJob({
    jobName: body.jobName,
    trigger: ScheduledJobTrigger.MANUAL,
    input,
    idempotencyKey: body.idempotencyKey,
    requestedByUserId: admin.id,
  });
  await recordAdminAuditLog({
    adminUserId: admin.id,
    action: "OTHER",
    entityType: "ScheduledJobRun",
    entityId: run.id,
    after: run,
    metadata: { jobName: body.jobName, dryRun: body.dryRun ?? false },
    request,
  });
  return run;
}

export async function getAdminJobStatus() {
  const status = await getSchedulerStatus();
  return {
    ...status,
    registeredJobs: listRegisteredJobs(),
  };
}
