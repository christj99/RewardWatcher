import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";

const adminHeaders = { "x-user-email": "admin@example.com" };

describe("admin corrections and review tasks API", () => {
  it("non-admin cannot access /v1/admin/corrections", async () => {
    const server = await buildSeededServer();

    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/corrections",
    });

    expect(response.statusCode).toBe(403);

    await server.close();
  });

  it("admin can list and filter corrections", async () => {
    const server = await buildSeededServer();
    const correction = await createCorrectionWithTask(server, "WRONG_CATEGORY");

    const response = await server.inject({
      method: "GET",
      url: `/v1/admin/corrections?status=OPEN&recommendationEventId=${correction.recommendationEventId}`,
      headers: adminHeaders,
    });
    const ids = response.json().map((item: { id: string }) => item.id);

    expect(response.statusCode).toBe(200);
    expect(ids).toContain(correction.id);

    await server.close();
  });

  it("admin can update correction status and resolution notes", async () => {
    const server = await buildSeededServer();
    const correction = await createCorrectionWithTask(server, "WRONG_CATEGORY");

    const response = await server.inject({
      method: "PATCH",
      url: `/v1/admin/corrections/${correction.id}`,
      headers: adminHeaders,
      payload: {
        status: "IN_REVIEW",
        resolutionNotes: "Looking at this now.",
      },
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe("IN_REVIEW");
    expect(body.resolutionNotes).toBe("Looking at this now.");
    expect(body.reviewTasks[0].status).toBe("IN_PROGRESS");

    await server.close();
  });

  it("updating correction to RESOLVED updates related review task", async () => {
    const server = await buildSeededServer();
    const correction = await createCorrectionWithTask(
      server,
      "WRONG_CARD_RULE",
    );

    const response = await server.inject({
      method: "PATCH",
      url: `/v1/admin/corrections/${correction.id}`,
      headers: adminHeaders,
      payload: {
        status: "RESOLVED",
        resolutionNotes: "Rule source verified.",
      },
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe("RESOLVED");
    expect(body.reviewTasks[0].status).toBe("RESOLVED");

    await server.close();
  });

  it("non-admin cannot access /v1/admin/review-tasks", async () => {
    const server = await buildSeededServer();

    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/review-tasks",
    });

    expect(response.statusCode).toBe(403);

    await server.close();
  });

  it("admin can list and filter review tasks", async () => {
    const server = await buildSeededServer();
    const correction = await createCorrectionWithTask(
      server,
      "WRONG_CARD_RULE",
    );
    const reviewTask = await firstReviewTask(correction.id);

    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/review-tasks?status=OPEN&taskType=CARD_RULE_REVIEW&priority=HIGH",
      headers: adminHeaders,
    });
    const ids = response.json().map((item: { id: string }) => item.id);

    expect(response.statusCode).toBe(200);
    expect(ids).toContain(reviewTask.id);

    await server.close();
  });

  it("admin can get review task detail", async () => {
    const server = await buildSeededServer();
    const correction = await createCorrectionWithTask(server, "WRONG_MERCHANT");
    const reviewTask = await firstReviewTask(correction.id);

    const response = await server.inject({
      method: "GET",
      url: `/v1/admin/review-tasks/${reviewTask.id}`,
      headers: adminHeaders,
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.id).toBe(reviewTask.id);
    expect(body.correction.recommendationEvent.recommendedCard).toBeDefined();
    expect(body.correction.user.email).toBe("beta@example.com");

    await server.close();
  });

  it("admin can update review task status, priority, and resolution notes", async () => {
    const server = await buildSeededServer();
    const correction = await createCorrectionWithTask(server, "WRONG_CATEGORY");
    const reviewTask = await firstReviewTask(correction.id);

    const response = await server.inject({
      method: "PATCH",
      url: `/v1/admin/review-tasks/${reviewTask.id}`,
      headers: adminHeaders,
      payload: {
        status: "IN_PROGRESS",
        priority: "HIGH",
        resolutionNotes: "Escalating category check.",
      },
    });
    const body = response.json();
    const updatedCorrection =
      await prisma.recommendationCorrection.findUniqueOrThrow({
        where: { id: correction.id },
      });

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe("IN_PROGRESS");
    expect(body.priority).toBe("HIGH");
    expect(body.resolutionNotes).toBe("Escalating category check.");
    expect(updatedCorrection.status).toBe("IN_REVIEW");

    await server.close();
  });

  it("updating review task to RESOLVED updates linked correction", async () => {
    const server = await buildSeededServer();
    const correction = await createCorrectionWithTask(
      server,
      "CAP_NOT_HANDLED",
    );
    const reviewTask = await firstReviewTask(correction.id);

    const response = await server.inject({
      method: "PATCH",
      url: `/v1/admin/review-tasks/${reviewTask.id}`,
      headers: adminHeaders,
      payload: {
        status: "RESOLVED",
        resolutionNotes: "Cap behavior reviewed.",
      },
    });
    const updatedCorrection =
      await prisma.recommendationCorrection.findUniqueOrThrow({
        where: { id: correction.id },
      });

    expect(response.statusCode).toBe(200);
    expect(updatedCorrection.status).toBe("RESOLVED");

    await server.close();
  });

  it("existing recommendation creation still works", async () => {
    const server = await buildSeededServer();
    const recommendation = await createRecommendation(server);

    expect(recommendation.id).toBeDefined();

    await server.close();
  });
});

async function createRecommendation(
  server: Awaited<ReturnType<typeof buildSeededServer>>,
) {
  const merchant = await prisma.merchant.findUniqueOrThrow({
    where: { slug: "local-restaurant-test-merchant" },
  });
  const response = await server.inject({
    method: "POST",
    url: "/v1/recommendations",
    payload: {
      merchantId: merchant.id,
      purchaseAmountCents: 5000,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json() as { id: string };
}

async function createCorrectionWithTask(
  server: Awaited<ReturnType<typeof buildSeededServer>>,
  correctionType: string,
) {
  const recommendation = await createRecommendation(server);
  const response = await server.inject({
    method: "POST",
    url: `/v1/recommendations/${recommendation.id}/correction`,
    payload: {
      correctionType,
      userNote: `Admin workflow test for ${correctionType}.`,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json().correction as {
    id: string;
    recommendationEventId: string;
  };
}

async function firstReviewTask(correctionId: string) {
  return prisma.curatorReviewTask.findFirstOrThrow({
    where: { correctionId },
    orderBy: { createdAt: "desc" },
  });
}
