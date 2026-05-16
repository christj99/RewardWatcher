import type {
  ScheduledJobName,
  ScheduledJobRun,
  ScheduledJobTrigger,
} from "@prisma/client";

export type JobInput = Record<string, unknown>;

export type JobResult = {
  status: "SUCCEEDED" | "SKIPPED";
  summary: Record<string, unknown>;
};

export type RegisteredJob = {
  name: ScheduledJobName;
  run: (input: JobInput) => Promise<JobResult>;
};

export type RunScheduledJobInput = {
  jobName: ScheduledJobName;
  trigger: ScheduledJobTrigger;
  input?: JobInput | undefined;
  idempotencyKey?: string | undefined;
  requestedByUserId?: string | undefined;
  lockTtlMs?: number | undefined;
};

export type ScheduledJobRunWithParsedResult = ScheduledJobRun;
