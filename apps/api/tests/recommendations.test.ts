import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";

describe("recommendations API", () => {
  it("POST /v1/recommendations returns a primary recommendation and persists event", async () => {
    const server = await buildSeededServer();
    const merchant = await prisma.merchant.findUniqueOrThrow({
      where: { slug: "local-restaurant-test-merchant" },
    });

    const response = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      payload: {
        merchantId: merchant.id,
        purchaseAmountCents: 5000,
        lens: "PRACTICAL",
        context: "MANUAL_LOOKUP",
      },
    });
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.primaryRecommendation.cardName).toContain("Gold");

    const event = await prisma.recommendationEvent.findUniqueOrThrow({
      where: { id: body.id },
    });
    expect(event.inputSnapshot).toBeTruthy();
    expect(event.rankingSnapshot).toBeTruthy();
    expect(event.ruleSnapshot).toBeTruthy();

    await server.close();
  });

  it("GET /v1/recommendations/history returns persisted recommendations", async () => {
    const server = await buildSeededServer();
    const email = "recommendation-history@example.com";
    await createUserWithSeededWallet(email);
    const headers = { "x-user-email": email };
    const created = await createRecommendation(server, headers);
    const response = await server.inject({
      method: "GET",
      url: "/v1/recommendations/history",
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((item: { id: string }) => item.id)).toContain(
      created.id,
    );

    await server.close();
  });

  it("GET /v1/recommendations/:id returns full receipt", async () => {
    const server = await buildSeededServer();
    const created = await createRecommendation(server);

    const response = await server.inject({
      method: "GET",
      url: `/v1/recommendations/${created.id}`,
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.id).toBe(created.id);
    expect(body.recommendedCard).toBeDefined();
    expect(body.inputSnapshot).toBeTruthy();
    expect(body.rankingSnapshot).toBeTruthy();
    expect(body.ruleSnapshot).toBeTruthy();
    expect(Array.isArray(body.outcomes)).toBe(true);
    expect(Array.isArray(body.corrections)).toBe(true);

    await server.close();
  });

  it("invalid negative purchaseAmountCents returns 400", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      payload: {
        merchantName: "Starbucks",
        purchaseAmountCents: -1,
      },
    });

    expect(response.statusCode).toBe(400);

    await server.close();
  });

  it("missing merchant fields returns 400", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      payload: {
        purchaseAmountCents: 1000,
      },
    });

    expect(response.statusCode).toBe(400);

    await server.close();
  });

  it("user with no active wallet returns 422", async () => {
    const server = await buildSeededServer();
    await prisma.user.upsert({
      where: { email: "no-wallet@example.com" },
      update: { displayName: "No Wallet" },
      create: { email: "no-wallet@example.com", displayName: "No Wallet" },
    });
    const response = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      headers: { "x-user-email": "no-wallet@example.com" },
      payload: {
        merchantName: "Starbucks",
        purchaseAmountCents: 1000,
      },
    });

    expect(response.statusCode).toBe(422);

    await server.close();
  });
});

async function createRecommendation(
  server: Awaited<ReturnType<typeof buildSeededServer>>,
  headers?: Record<string, string>,
) {
  const merchant = await prisma.merchant.findUniqueOrThrow({
    where: { slug: "starbucks" },
  });
  const response = await server.inject({
    method: "POST",
    url: "/v1/recommendations",
    headers,
    payload: {
      merchantId: merchant.id,
      purchaseAmountCents: 5000,
    },
  });

  expect(response.statusCode).toBe(201);
  return response.json() as { id: string };
}

async function createUserWithSeededWallet(email: string) {
  const [user, betaUser] = await Promise.all([
    prisma.user.upsert({
      where: { email },
      update: { displayName: "Recommendation History User" },
      create: { email, displayName: "Recommendation History User" },
    }),
    prisma.user.findUniqueOrThrow({ where: { email: "beta@example.com" } }),
  ]);
  const betaWallet = await prisma.userCard.findMany({
    where: { userId: betaUser.id, isActive: true },
    select: { cardId: true },
  });

  for (const { cardId } of betaWallet) {
    await prisma.userCard.upsert({
      where: { userId_cardId: { userId: user.id, cardId } },
      update: { isActive: true },
      create: { userId: user.id, cardId, isActive: true },
    });
  }
}
