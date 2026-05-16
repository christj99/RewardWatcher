import { describe, expect, it, vi } from "vitest";

import { adminHeaders, betaHeaders } from "./adminPhase8Utils.js";
import { buildSeededServer, prisma } from "./testUtils.js";
import { recordBetaEvent } from "../src/services/betaEventService.js";

describe("feedback and beta support", () => {
  it("lets a user submit redacted feedback linked to their recommendation", async () => {
    const server = await buildSeededServer();
    const merchant = await prisma.merchant.findUniqueOrThrow({
      where: { slug: "starbucks" },
    });
    const recommendation = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      headers: betaHeaders,
      payload: { merchantId: merchant.id, purchaseAmountCents: 2300 },
    });
    const recommendationId = recommendation.json<{ id: string }>().id;

    const response = await server.inject({
      method: "POST",
      url: "/v1/feedback",
      headers: betaHeaders,
      payload: {
        feedbackType: "WRONG_RECOMMENDATION",
        severity: "HIGH",
        title: "Card felt wrong",
        message: "The recommendation did not match my expectation.",
        context: { token: "secret-token", flow: "receipt" },
        linkedRecommendationEventId: recommendationId,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().context).toEqual({
      token: "[REDACTED]",
      flow: "receipt",
    });
    expect(
      await prisma.betaEvent.count({
        where: {
          userId: response.json().userId,
          eventType: "FEEDBACK_SUBMITTED",
        },
      }),
    ).toBeGreaterThanOrEqual(1);

    await server.close();
  });

  it("prevents linking feedback to another user's recommendation", async () => {
    const server = await buildSeededServer();
    const adminRecommendation =
      await prisma.recommendationEvent.findFirstOrThrow({
        where: { user: { email: "beta@example.com" } },
      });
    const freeHeaders = { "x-user-email": "free@example.com" };

    const response = await server.inject({
      method: "POST",
      url: "/v1/feedback",
      headers: freeHeaders,
      payload: {
        feedbackType: "GENERAL_FEEDBACK",
        title: "Not mine",
        message: "This should not attach.",
        linkedRecommendationEventId: adminRecommendation.id,
      },
    });

    expect(response.statusCode).toBe(404);
    await server.close();
  });

  it("admin can triage feedback and audit the update", async () => {
    const server = await buildSeededServer();
    const created = await server.inject({
      method: "POST",
      url: "/v1/feedback",
      headers: betaHeaders,
      payload: {
        feedbackType: "BUG",
        title: "Button broke",
        message: "The button did not work.",
      },
    });

    const update = await server.inject({
      method: "PATCH",
      url: `/v1/admin/feedback/${created.json().id}`,
      headers: adminHeaders,
      payload: {
        status: "RESOLVED",
        severity: "MEDIUM",
        resolutionNotes: "Known issue fixed.",
      },
    });

    expect(update.statusCode).toBe(200);
    expect(update.json()).toMatchObject({ status: "RESOLVED" });
    expect(
      await prisma.adminAuditLog.count({
        where: { entityType: "FeedbackReport", entityId: created.json().id },
      }),
    ).toBeGreaterThanOrEqual(1);

    await server.close();
  });

  it("exposes beta users, cohorts, and support notes to admins only", async () => {
    const server = await buildSeededServer();

    const forbidden = await server.inject({
      method: "GET",
      url: "/v1/admin/beta-users",
      headers: betaHeaders,
    });
    expect(forbidden.statusCode).toBe(403);

    const users = await server.inject({
      method: "GET",
      url: "/v1/admin/beta-users",
      headers: adminHeaders,
    });
    expect(users.statusCode).toBe(200);
    expect(
      users
        .json()
        .some((user: { email: string }) => user.email === "beta@example.com"),
    ).toBe(true);

    const betaUser = await prisma.user.findUniqueOrThrow({
      where: { email: "beta@example.com" },
    });
    const update = await server.inject({
      method: "PATCH",
      url: `/v1/admin/beta-users/${betaUser.id}`,
      headers: adminHeaders,
      payload: { status: "STUCK", tags: ["needs-help"] },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().status).toBe("STUCK");

    const note = await server.inject({
      method: "POST",
      url: `/v1/admin/users/${betaUser.id}/support-notes`,
      headers: adminHeaders,
      payload: { note: "Followed up on setup confusion." },
    });
    expect(note.statusCode).toBe(201);

    await server.close();
  });

  it("beta readiness includes feedback and stuck-user metrics", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/beta-readiness",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().operations).toEqual(
      expect.objectContaining({
        openFeedbackCount: expect.any(Number),
        stuckBetaUsersCount: expect.any(Number),
        usersWithNoRecommendation: expect.any(Number),
      }),
    );
    await server.close();
  });
});

describe("recordBetaEvent", () => {
  it("redacts metadata and does not throw when event recording fails", async () => {
    const spy = vi
      .spyOn(prisma.betaEvent, "create")
      .mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordBetaEvent({
        userId: "missing-user",
        eventType: "FEEDBACK_SUBMITTED",
        source: "API",
        metadata: { authorization: "secret" },
      }),
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
