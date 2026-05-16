import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";

describe("wallet API", () => {
  it("GET /v1/wallet returns beta user's active cards", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({ method: "GET", url: "/v1/wallet" });

    expect(response.statusCode).toBe(200);
    expect(response.json().length).toBeGreaterThanOrEqual(4);

    await server.close();
  });

  it("POST /v1/wallet adds or reactivates a card not already active", async () => {
    const server = await buildSeededServer();
    const [beta, blueCash] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: "beta@example.com" } }),
      prisma.card.findUniqueOrThrow({
        where: { slug: "amex-blue-cash-preferred" },
      }),
    ]);
    await prisma.userCard.updateMany({
      where: { userId: beta.id, cardId: blueCash.id },
      data: { isActive: false },
    });

    const response = await server.inject({
      method: "POST",
      url: "/v1/wallet",
      payload: {
        cardId: blueCash.id,
        nickname: "Blue Cash",
        annualFeeDueMonth: 5,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      cardId: blueCash.id,
      nickname: "Blue Cash",
      isActive: true,
    });

    await server.close();
  });

  it("POST /v1/wallet duplicate active card returns 409", async () => {
    const server = await buildSeededServer();
    const card = await prisma.card.findUniqueOrThrow({
      where: { slug: "amex-gold" },
    });

    const response = await server.inject({
      method: "POST",
      url: "/v1/wallet",
      payload: { cardId: card.id },
    });

    expect(response.statusCode).toBe(409);

    await server.close();
  });

  it("PATCH /v1/wallet/:id updates nickname and annual fee month", async () => {
    const server = await buildSeededServer();
    const userCard = await betaUserCard("amex-gold");

    const response = await server.inject({
      method: "PATCH",
      url: `/v1/wallet/${userCard.id}`,
      payload: {
        nickname: "Gold dining",
        annualFeeDueMonth: 7,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: userCard.id,
      nickname: "Gold dining",
      annualFeeDueMonth: 7,
    });

    await server.close();
  });

  it("DELETE /v1/wallet/:id soft deactivates card", async () => {
    const server = await buildSeededServer();
    const userCard = await betaUserCard("amex-blue-cash-preferred");

    const response = await server.inject({
      method: "DELETE",
      url: `/v1/wallet/${userCard.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: userCard.id,
      isActive: false,
    });

    await server.close();
  });

  it("cannot update another user's UserCard", async () => {
    const server = await buildSeededServer();
    const [admin, card] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: "admin@example.com" } }),
      prisma.card.findUniqueOrThrow({
        where: { slug: "chase-sapphire-preferred" },
      }),
    ]);
    const adminCard = await prisma.userCard.upsert({
      where: {
        userId_cardId: {
          userId: admin.id,
          cardId: card.id,
        },
      },
      update: { isActive: true },
      create: {
        userId: admin.id,
        cardId: card.id,
        isActive: true,
      },
    });

    const response = await server.inject({
      method: "PATCH",
      url: `/v1/wallet/${adminCard.id}`,
      payload: { nickname: "Nope" },
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });
});

async function betaUserCard(cardSlug: string) {
  const beta = await prisma.user.findUniqueOrThrow({
    where: { email: "beta@example.com" },
  });
  const card = await prisma.card.findUniqueOrThrow({
    where: { slug: cardSlug },
  });

  return prisma.userCard.findUniqueOrThrow({
    where: {
      userId_cardId: {
        userId: beta.id,
        cardId: card.id,
      },
    },
  });
}
