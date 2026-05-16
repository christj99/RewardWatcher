import { ScheduledJobName, ScheduledJobTrigger } from "@prisma/client";
import { seedDatabase } from "@rewards-audit/db";
import { beforeEach, describe, expect, it } from "vitest";

import {
  acquireJobLock,
  releaseJobLock,
} from "../src/services/jobs/jobLocks.js";
import { runScheduledJob } from "../src/services/jobs/jobRunner.js";
import { createScheduler } from "../src/services/jobs/scheduler.js";
import { setErrorReporterForTesting } from "../src/services/observability/errorReporter.js";
import { buildSeededServer, prisma } from "./testUtils.js";

const adminHeaders = { "x-user-email": "admin@example.com" };
const betaHeaders = { "x-user-email": "beta@example.com" };

describe("scheduled job runner", () => {
  beforeEach(async () => {
    await prisma.scheduledJobRun.deleteMany();
    await prisma.scheduledJobLock.deleteMany();
    await prisma.adminAuditLog.deleteMany({
      where: { entityType: "ScheduledJobRun" },
    });
    setErrorReporterForTesting(null);
  });

  it("creates succeeded runs and respects idempotency keys", async () => {
    await seedDatabase();
    const first = await runScheduledJob({
      jobName: ScheduledJobName.REMINDER_DIGEST,
      trigger: ScheduledJobTrigger.CLI,
      input: { dryRun: true, userId: "missing-user" },
      idempotencyKey: "test-reminder-digest-idempotent",
    });
    const second = await runScheduledJob({
      jobName: ScheduledJobName.REMINDER_DIGEST,
      trigger: ScheduledJobTrigger.CLI,
      input: { dryRun: true, userId: "missing-user" },
      idempotencyKey: "test-reminder-digest-idempotent",
    });

    expect(first.status).toBe("SUCCEEDED");
    expect(second.id).toBe(first.id);
    expect(await prisma.scheduledJobRun.count()).toBe(1);
  });

  it("records failed runs with redacted errors", async () => {
    await seedDatabase();
    const captured: unknown[] = [];
    setErrorReporterForTesting({
      captureException: (_error, context) => captured.push(context),
      captureMessage: () => undefined,
    });
    const run = await runScheduledJob({
      jobName: ScheduledJobName.STATEMENT_CREDIT_USAGE_GENERATION,
      trigger: ScheduledJobTrigger.CLI,
      input: {
        userId: (
          await prisma.user.findUniqueOrThrow({
            where: { email: "beta@example.com" },
          })
        ).id,
        periodStart: "2026-02-01T00:00:00.000Z",
        periodEnd: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(run.status).toBe("FAILED");
    expect(run.errorMessage).toContain("periodStart");
    expect(captured).toHaveLength(1);
    expect(JSON.stringify(captured[0])).toContain(
      "STATEMENT_CREDIT_USAGE_GENERATION",
    );
  });

  it("skips when the same job is locked and replaces stale locks", async () => {
    await seedDatabase();
    const activeLock = await acquireJobLock({
      jobName: ScheduledJobName.ADMIN_ALERT,
      lockedBy: "test",
      ttlMs: 60_000,
    });
    expect(activeLock).toBeTruthy();
    const skipped = await runScheduledJob({
      jobName: ScheduledJobName.ADMIN_ALERT,
      trigger: ScheduledJobTrigger.CLI,
      input: { dryRun: true },
    });
    expect(skipped.status).toBe("SKIPPED");
    if (activeLock) await releaseJobLock(activeLock);

    await prisma.scheduledJobLock.create({
      data: {
        jobName: ScheduledJobName.ADMIN_ALERT,
        lockedBy: "stale",
        lockedAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-01-01T00:01:00.000Z"),
      },
    });
    const replaced = await runScheduledJob({
      jobName: ScheduledJobName.ADMIN_ALERT,
      trigger: ScheduledJobTrigger.CLI,
      input: { dryRun: true },
    });
    expect(replaced.status).toBe("SUCCEEDED");
  });

  it("admin jobs API lists, triggers, audits, and protects routes", async () => {
    const server = await buildSeededServer();
    const nonAdmin = await server.inject({
      method: "GET",
      url: "/v1/admin/jobs/runs",
      headers: betaHeaders,
    });
    const status = await server.inject({
      method: "GET",
      url: "/v1/admin/jobs/status",
      headers: adminHeaders,
    });
    const triggered = await server.inject({
      method: "POST",
      url: "/v1/admin/jobs/run",
      headers: adminHeaders,
      payload: {
        jobName: "ADMIN_ALERT",
        dryRun: true,
        input: {},
      },
    });
    const listed = await server.inject({
      method: "GET",
      url: "/v1/admin/jobs/runs?jobName=ADMIN_ALERT",
      headers: adminHeaders,
    });

    expect(nonAdmin.statusCode).toBe(403);
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ schedulerEnabled: false });
    expect(triggered.statusCode).toBe(200);
    expect(triggered.json()).toMatchObject({
      jobName: "ADMIN_ALERT",
      status: "SUCCEEDED",
      triggeredBy: "MANUAL",
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);
    expect(
      await prisma.adminAuditLog.count({
        where: { entityType: "ScheduledJobRun" },
      }),
    ).toBe(1);

    await server.close();
  });

  it("scheduler is disabled by default", () => {
    const scheduler = createScheduler();
    expect(scheduler.enabled).toBe(false);
    expect(scheduler.schedules.length).toBeGreaterThan(0);
    scheduler.stop();
  });
});
