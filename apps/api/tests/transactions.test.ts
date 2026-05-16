import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";
import {
  betaUserCard,
  futureDate,
  importTransaction,
  uniqueId,
} from "./phase5TestUtils.js";

describe("transactions API", () => {
  it("POST /v1/transactions/import creates manual transaction and normalizes merchant", async () => {
    const server = await buildSeededServer();
    const userCard = await betaUserCard("amex-gold");

    const response = await server.inject({
      method: "POST",
      url: "/v1/transactions/import",
      payload: {
        transactions: [
          {
            externalId: uniqueId("manual-starbucks"),
            rawMerchantName: "STARBUCKS STORE #1234",
            amountCents: 5000,
            transactionDate: futureDate(),
            userCardId: userCard.id,
          },
        ],
      },
    });
    const item = response.json().imported[0];

    expect(response.statusCode).toBe(201);
    expect(item.status).toBe("created");
    expect(item.transaction.normalizedMerchantName).toBe("starbucks");
    expect(item.transaction.merchant.slug).toBe("starbucks");

    await server.close();
  });

  it("validates userCardId belongs to current user", async () => {
    const server = await buildSeededServer();
    const adminCard = await adminUserCard();

    const response = await server.inject({
      method: "POST",
      url: "/v1/transactions/import",
      payload: {
        transactions: [
          {
            rawMerchantName: "Starbucks",
            amountCents: 5000,
            transactionDate: futureDate(),
            userCardId: adminCard.id,
          },
        ],
      },
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });

  it("rejects negative amount and empty transaction arrays", async () => {
    const server = await buildSeededServer();

    const negative = await server.inject({
      method: "POST",
      url: "/v1/transactions/import",
      payload: {
        transactions: [
          {
            rawMerchantName: "Starbucks",
            amountCents: -1,
            transactionDate: futureDate(),
          },
        ],
      },
    });
    const empty = await server.inject({
      method: "POST",
      url: "/v1/transactions/import",
      payload: { transactions: [] },
    });

    expect(negative.statusCode).toBe(400);
    expect(empty.statusCode).toBe(400);

    await server.close();
  });

  it("dedupes same user/source/externalId", async () => {
    const server = await buildSeededServer();
    const externalId = uniqueId("dedupe");
    const payload = {
      transactions: [
        {
          externalId,
          rawMerchantName: "Starbucks",
          amountCents: 5000,
          transactionDate: futureDate(),
        },
      ],
    };

    const first = await server.inject({
      method: "POST",
      url: "/v1/transactions/import",
      payload,
    });
    const second = await server.inject({
      method: "POST",
      url: "/v1/transactions/import",
      payload,
    });

    expect(first.json().createdCount).toBe(1);
    expect(second.json().existingCount).toBe(1);

    await server.close();
  });

  it("GET /v1/transactions returns current user's transactions only", async () => {
    const server = await buildSeededServer();
    const created = await importTransaction(
      server,
      "STARBUCKS STORE #5555",
      "chase-freedom-unlimited",
      5000,
      futureDateYearsFromNow(7000),
    );
    await createOtherUserTransaction();

    const response = await server.inject({
      method: "GET",
      url: "/v1/transactions?limit=100",
    });
    const ids = response.json().map((item: { id: string }) => item.id);

    expect(response.statusCode).toBe(200);
    expect(ids).toContain(created.id);
    expect(ids).not.toContain("test-other-user-transaction");

    await server.close();
  });

  it("GET /v1/transactions/:id returns detail and protects ownership", async () => {
    const server = await buildSeededServer();
    const created = await importTransaction(server, "Starbucks");
    await createOtherUserTransaction();

    const own = await server.inject({
      method: "GET",
      url: `/v1/transactions/${created.id}`,
    });
    const other = await server.inject({
      method: "GET",
      url: "/v1/transactions/test-other-user-transaction",
    });

    expect(own.statusCode).toBe(200);
    expect(own.json().id).toBe(created.id);
    expect(other.statusCode).toBe(404);

    await server.close();
  });
});

async function adminUserCard() {
  const [admin, card] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "admin@example.com" } }),
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
  ]);

  return prisma.userCard.upsert({
    where: { userId_cardId: { userId: admin.id, cardId: card.id } },
    update: { isActive: true },
    create: { userId: admin.id, cardId: card.id, isActive: true },
  });
}

async function createOtherUserTransaction() {
  const [user, card, merchant] = await Promise.all([
    prisma.user.upsert({
      where: { email: "phase5-other@example.com" },
      update: {},
      create: { email: "phase5-other@example.com" },
    }),
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
  ]);
  const userCard = await prisma.userCard.upsert({
    where: { userId_cardId: { userId: user.id, cardId: card.id } },
    update: { isActive: true },
    create: { userId: user.id, cardId: card.id, isActive: true },
  });

  return prisma.transaction.upsert({
    where: { id: "test-other-user-transaction" },
    update: {},
    create: {
      id: "test-other-user-transaction",
      userId: user.id,
      userCardId: userCard.id,
      merchantId: merchant.id,
      rawMerchantName: "STARBUCKS",
      normalizedMerchantName: "starbucks",
      amountCents: 5000,
      transactionDate: new Date(),
      source: "TEST_FIXTURE",
    },
  });
}

function futureDateYearsFromNow(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString();
}
