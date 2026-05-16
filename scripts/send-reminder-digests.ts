import { ScheduledJobName, ScheduledJobTrigger } from "@prisma/client";

import { runScheduledJob } from "../apps/api/src/services/jobs/jobRunner.js";

const options = parseArgs(process.argv.slice(2));
const run = await runScheduledJob({
  jobName: ScheduledJobName.REMINDER_DIGEST,
  trigger: ScheduledJobTrigger.CLI,
  input: {
    dryRun: options.dryRun,
    userId: options.userId,
    lookaheadDays: options.lookaheadDays,
  },
  idempotencyKey: options.idempotencyKey,
});

console.log(
  JSON.stringify(
    { jobRunId: run.id, status: run.status, result: run.result },
    null,
    2,
  ),
);

function parseArgs(args: string[]) {
  const values: Record<string, string> = {};
  for (const arg of args) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=", 2);
    values[key] = value;
  }
  return {
    dryRun: values.dryRun === "true",
    userId: values.userId,
    lookaheadDays: values.lookaheadDays
      ? Number(values.lookaheadDays)
      : undefined,
    idempotencyKey: values.idempotencyKey,
  };
}
