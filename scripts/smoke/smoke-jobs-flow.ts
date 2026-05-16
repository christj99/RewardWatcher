import { assertSmoke, logStep, SmokeClient } from "./smokeUtils.js";

async function main() {
  const admin = new SmokeClient(undefined, "jobs-flow");
  await admin.login("admin@example.com", "AdminPassword12345!");

  for (const jobName of [
    "WEEKLY_AUDIT_EMAIL",
    "REMINDER_DIGEST",
    "ADMIN_ALERT",
  ] as const) {
    const run = await admin.request<{ id: string; status: string }>(
      "/v1/admin/jobs/run",
      {
        method: "POST",
        body: {
          jobName,
          dryRun: true,
          idempotencyKey: `smoke:${jobName}:${Date.now()}`,
        },
      },
    );
    assertSmoke(run.id, `${jobName} did not return a job run id.`);
    logStep(`${jobName} dry-run completed with ${run.status}`);
  }

  const runs = await admin.request<unknown>("/v1/admin/jobs/runs", {
    query: { limit: 10 },
  });
  assertSmoke(runs, "Job run list did not return a payload.");
  logStep("ScheduledJobRun records are visible");

  console.log("Jobs flow smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
