import { describe, expect, it } from "vitest";

import { seedBetaDemo } from "../../../scripts/seed-beta-demo.js";
import { adminHeaders, betaHeaders } from "./adminPhase8Utils.js";
import { buildSeededServer, prisma } from "./testUtils.js";

describe("private beta readiness", () => {
  it("is admin-only and returns launch gate fields", async () => {
    const server = await buildSeededServer();

    const forbidden = await server.inject({
      method: "GET",
      url: "/v1/admin/beta-readiness",
      headers: betaHeaders,
    });
    expect(forbidden.statusCode).toBe(403);

    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/beta-readiness",
      headers: adminHeaders,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toMatch(/READY|CAUTION|BLOCKED/);
    expect(body.config).toEqual(
      expect.objectContaining({
        plaidConfigured: expect.any(Boolean),
        stripeConfigured: expect.any(Boolean),
        postmarkConfigured: expect.any(Boolean),
        sentryConfigured: expect.any(Boolean),
        schedulerEnabled: expect.any(Boolean),
      }),
    );
    expect(body.operations).toEqual(
      expect.objectContaining({
        databaseReady: expect.any(Boolean),
        recentJobFailures: expect.any(Number),
        unresolvedPrivacyRequests: expect.any(Number),
      }),
    );
    expect(body.releaseChecklist.length).toBeGreaterThan(0);

    await server.close();
  });

  it("seeds the beta demo fixture idempotently", async () => {
    await seedBetaDemo();
    await seedBetaDemo();

    const demo = await prisma.user.findUniqueOrThrow({
      where: { email: "demo@example.com" },
      include: {
        userCards: true,
        recommendationEvents: true,
        transactions: true,
        recommendationOutcomes: true,
        reminders: true,
        statementCreditUsages: true,
        emailLogs: true,
      },
    });

    expect(demo.userCards.length).toBeGreaterThanOrEqual(2);
    expect(demo.recommendationEvents.length).toBeGreaterThanOrEqual(1);
    expect(demo.transactions.length).toBeGreaterThanOrEqual(1);
    expect(demo.recommendationOutcomes.length).toBeGreaterThanOrEqual(1);
    expect(demo.reminders.length).toBeGreaterThanOrEqual(1);
    expect(demo.statementCreditUsages.length).toBeGreaterThanOrEqual(1);
    expect(demo.emailLogs.length).toBeGreaterThanOrEqual(1);

    const jobRunCount = await prisma.scheduledJobRun.count({
      where: { idempotencyKey: "demo-job-run-weekly-audit" },
    });
    expect(jobRunCount).toBe(1);
  });
});
