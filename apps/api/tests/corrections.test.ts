import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";

describe("corrections API", () => {
  it("submits WRONG_CATEGORY correction and creates POSTING_PROFILE_REVIEW task", async () => {
    const server = await buildSeededServer();
    const recommendation = await createRecommendation(server);

    const response = await server.inject({
      method: "POST",
      url: `/v1/recommendations/${recommendation.id}/correction`,
      payload: {
        correctionType: "WRONG_CATEGORY",
        userNote: "This posted as something else.",
      },
    });
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.correction).toMatchObject({
      correctionType: "WRONG_CATEGORY",
      status: "OPEN",
    });
    expect(body.reviewTask).toMatchObject({
      taskType: "POSTING_PROFILE_REVIEW",
      priority: "MEDIUM",
    });

    await server.close();
  });

  it.each([
    ["WRONG_CARD_RULE", "CARD_RULE_REVIEW", "HIGH"],
    ["CAP_NOT_HANDLED", "CARD_RULE_REVIEW", "HIGH"],
    ["WRONG_MERCHANT", "MERCHANT_MAPPING_REVIEW", "MEDIUM"],
    ["MISSED_OFFER", "OFFER_REVIEW", "MEDIUM"],
    ["OTHER", "OTHER", "LOW"],
  ])(
    "%s correction creates %s review task",
    async (correctionType, taskType, priority) => {
      const server = await buildSeededServer();
      const recommendation = await createRecommendation(server);

      const response = await server.inject({
        method: "POST",
        url: `/v1/recommendations/${recommendation.id}/correction`,
        payload: {
          correctionType,
          userNote: `Please check ${correctionType}.`,
        },
      });
      const body = response.json();

      expect(response.statusCode).toBe(201);
      expect(body.reviewTask).toMatchObject({ taskType, priority });

      await server.close();
    },
  );

  it("PERSONAL_PREFERENCE correction does not create review task by default", async () => {
    const server = await buildSeededServer();
    const recommendation = await createRecommendation(server);

    const response = await server.inject({
      method: "POST",
      url: `/v1/recommendations/${recommendation.id}/correction`,
      payload: {
        correctionType: "PERSONAL_PREFERENCE",
        userNote: "I just prefer another card here.",
      },
    });
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.reviewTask).toBeNull();
    expect(body.userPreferenceRule).toBeNull();

    await server.close();
  });

  it("PERSONAL_PREFERENCE with AVOID_CARD creates UserPreferenceRule", async () => {
    const server = await buildSeededServer();
    const [recommendation, card] = await Promise.all([
      createRecommendation(server),
      prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
    ]);

    const response = await server.inject({
      method: "POST",
      url: `/v1/recommendations/${recommendation.id}/correction`,
      payload: {
        correctionType: "PERSONAL_PREFERENCE",
        preferenceAction: "AVOID_CARD",
        suggestedCardId: card.id,
        userNote: "I do not want to use this card for coffee.",
      },
    });
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.reviewTask).toBeNull();
    expect(body.userPreferenceRule).toMatchObject({
      cardId: card.id,
      preferenceType: "AVOID_CARD",
    });

    await server.close();
  });

  it("PERSONAL_PREFERENCE with insufficient info saves correction only", async () => {
    const server = await buildSeededServer();
    const recommendation = await createRecommendation(server);

    const response = await server.inject({
      method: "POST",
      url: `/v1/recommendations/${recommendation.id}/correction`,
      payload: {
        correctionType: "PERSONAL_PREFERENCE",
        userNote: "Not useful to encode yet.",
      },
    });
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.correction.id).toBeDefined();
    expect(body.userPreferenceRule).toBeNull();

    await server.close();
  });

  it("user cannot correct another user's RecommendationEvent", async () => {
    const server = await buildSeededServer();
    const otherRecommendation = await createOtherUserRecommendation();

    const response = await server.inject({
      method: "POST",
      url: `/v1/recommendations/${otherRecommendation.id}/correction`,
      payload: {
        correctionType: "WRONG_CATEGORY",
      },
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });

  it("invalid correctionType returns 400", async () => {
    const server = await buildSeededServer();
    const recommendation = await createRecommendation(server);

    const response = await server.inject({
      method: "POST",
      url: `/v1/recommendations/${recommendation.id}/correction`,
      payload: {
        correctionType: "NOPE",
      },
    });

    expect(response.statusCode).toBe(400);

    await server.close();
  });

  it("invalid suggestedMerchantId returns 404", async () => {
    const server = await buildSeededServer();
    const recommendation = await createRecommendation(server);

    const response = await server.inject({
      method: "POST",
      url: `/v1/recommendations/${recommendation.id}/correction`,
      payload: {
        correctionType: "WRONG_MERCHANT",
        suggestedMerchantId: "missing-merchant",
      },
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });

  it("invalid suggestedCardId returns 404", async () => {
    const server = await buildSeededServer();
    const recommendation = await createRecommendation(server);

    const response = await server.inject({
      method: "POST",
      url: `/v1/recommendations/${recommendation.id}/correction`,
      payload: {
        correctionType: "PERSONAL_PREFERENCE",
        preferenceAction: "AVOID_CARD",
        suggestedCardId: "missing-card",
      },
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });

  it("GET /v1/corrections returns only current user's corrections", async () => {
    const server = await buildSeededServer();
    const recommendation = await createRecommendation(server);
    const correction = await submitCorrection(server, recommendation.id);
    await createOtherUserCorrection();

    const response = await server.inject({
      method: "GET",
      url: "/v1/corrections",
    });
    const ids = response.json().map((item: { id: string }) => item.id);

    expect(response.statusCode).toBe(200);
    expect(ids).toContain(correction.id);
    expect(ids).not.toContain("test-other-user-correction");

    await server.close();
  });

  it("GET /v1/corrections/:id returns own correction", async () => {
    const server = await buildSeededServer();
    const recommendation = await createRecommendation(server);
    const correction = await submitCorrection(server, recommendation.id);

    const response = await server.inject({
      method: "GET",
      url: `/v1/corrections/${correction.id}`,
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.id).toBe(correction.id);
    expect(body.recommendationEvent).toBeDefined();
    expect(Array.isArray(body.reviewTasks)).toBe(true);

    await server.close();
  });

  it("GET /v1/corrections/:id does not return another user's correction", async () => {
    const server = await buildSeededServer();
    await createOtherUserCorrection();

    const response = await server.inject({
      method: "GET",
      url: "/v1/corrections/test-other-user-correction",
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });

  it("recommendation detail includes corrections after submission", async () => {
    const server = await buildSeededServer();
    const recommendation = await createRecommendation(server);
    const correction = await submitCorrection(server, recommendation.id);

    const response = await server.inject({
      method: "GET",
      url: `/v1/recommendations/${recommendation.id}`,
    });
    const body = response.json();
    const correctionIds = body.corrections.map(
      (item: { id: string }) => item.id,
    );

    expect(response.statusCode).toBe(200);
    expect(correctionIds).toContain(correction.id);
    expect(body.corrections[0]).not.toHaveProperty("reviewTasks");

    await server.close();
  });
});

async function createRecommendation(
  server: Awaited<ReturnType<typeof buildSeededServer>>,
) {
  const merchant = await prisma.merchant.findUniqueOrThrow({
    where: { slug: "starbucks" },
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

async function submitCorrection(
  server: Awaited<ReturnType<typeof buildSeededServer>>,
  recommendationId: string,
) {
  const response = await server.inject({
    method: "POST",
    url: `/v1/recommendations/${recommendationId}/correction`,
    payload: {
      correctionType: "WRONG_CATEGORY",
      userNote: "Please review category.",
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json().correction as { id: string };
}

async function createOtherUserCorrection() {
  const recommendation = await createOtherUserRecommendation();
  await prisma.recommendationCorrection.upsert({
    where: { id: "test-other-user-correction" },
    update: {
      recommendationEventId: recommendation.id,
      status: "OPEN",
    },
    create: {
      id: "test-other-user-correction",
      userId: recommendation.userId,
      recommendationEventId: recommendation.id,
      correctionType: "WRONG_CATEGORY",
      status: "OPEN",
    },
  });
}

async function createOtherUserRecommendation() {
  const [user, merchant, card] = await Promise.all([
    prisma.user.upsert({
      where: { email: "phase4-other@example.com" },
      update: { displayName: "Phase 4 Other" },
      create: {
        email: "phase4-other@example.com",
        displayName: "Phase 4 Other",
      },
    }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
  ]);

  return prisma.recommendationEvent.upsert({
    where: { id: "test-other-user-recommendation" },
    update: {
      userId: user.id,
      merchantId: merchant.id,
      recommendedCardId: card.id,
    },
    create: {
      id: "test-other-user-recommendation",
      userId: user.id,
      merchantId: merchant.id,
      merchantNameInput: merchant.name,
      purchaseAmountCents: 5000,
      context: "MANUAL_LOOKUP",
      lens: "PRACTICAL",
      recommendedCardId: card.id,
      expectedCategory: "DINING",
      expectedValueCents: "320.0",
      confidence: "HIGH",
      explanation: "Fixture for ownership tests.",
      inputSnapshot: {},
      rankingSnapshot: {},
      ruleSnapshot: {},
    },
  });
}
