import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";

describe("statement credit usage API", () => {
  it("generates idempotent merchant-matched usage and allows manual updates", async () => {
    const server = await buildSeededServer();
    const fixture = await createCreditFixture("merchant");

    const first = await server.inject({
      method: "POST",
      url: "/v1/statement-credit-usage/generate",
      headers: { "x-user-email": fixture.user.email },
      payload: {
        userCardId: fixture.userCard.id,
        periodStart: fixture.periodStart,
        periodEnd: fixture.periodEnd,
      },
    });
    const second = await server.inject({
      method: "POST",
      url: "/v1/statement-credit-usage/generate",
      headers: { "x-user-email": fixture.user.email },
      payload: {
        userCardId: fixture.userCard.id,
        periodStart: fixture.periodStart,
        periodEnd: fixture.periodEnd,
      },
    });
    const usage = first
      .json()
      .usageRecords.find(
        (record: { statementCreditId: string }) =>
          record.statementCreditId === fixture.credit.id,
      );
    const patched = await server.inject({
      method: "PATCH",
      url: `/v1/statement-credit-usage/${usage.id}`,
      headers: { "x-user-email": fixture.user.email },
      payload: { status: "USED", notes: "Issuer credit confirmed manually." },
    });

    expect(first.statusCode).toBe(200);
    expect(usage.status).toBe("USED");
    expect(usage.amountUsedCents).toBe(1000);
    expect(usage.estimatedRemainingCents).toBe(0);
    expect(usage.source).toBe("IMPORTED_TRANSACTION");
    expect(second.json().generatedCount).toBe(0);
    expect(patched.json().source).toBe("MANUAL");
    expect(patched.json().notes).toBe("Issuer credit confirmed manually.");

    await server.close();
  }, 30_000);

  it("infers category usage, unknown usage, Plaid source, and protects ownership", async () => {
    const server = await buildSeededServer();
    const categoryFixture = await createCreditFixture("category", "PLAID");
    const unknownFixture = await createCreditFixture("unknown");

    const category = await server.inject({
      method: "POST",
      url: "/v1/statement-credit-usage/generate",
      headers: { "x-user-email": categoryFixture.user.email },
      payload: {
        userCardId: categoryFixture.userCard.id,
        periodStart: categoryFixture.periodStart,
        periodEnd: categoryFixture.periodEnd,
      },
    });
    const unknown = await server.inject({
      method: "POST",
      url: "/v1/statement-credit-usage/generate",
      headers: { "x-user-email": unknownFixture.user.email },
      payload: {
        userCardId: unknownFixture.userCard.id,
        periodStart: unknownFixture.periodStart,
        periodEnd: unknownFixture.periodEnd,
      },
    });
    const categoryUsage = category
      .json()
      .usageRecords.find(
        (record: { statementCreditId: string }) =>
          record.statementCreditId === categoryFixture.credit.id,
      );
    const unknownUsage = unknown
      .json()
      .usageRecords.find(
        (record: { statementCreditId: string }) =>
          record.statementCreditId === unknownFixture.credit.id,
      );
    const adminUsage = await createAdminUsage();
    const forbidden = await server.inject({
      method: "PATCH",
      url: `/v1/statement-credit-usage/${adminUsage.id}`,
      headers: { "x-user-email": categoryFixture.user.email },
      payload: { status: "USED" },
    });

    expect(categoryUsage.status).toBe("PARTIALLY_USED");
    expect(categoryUsage.source).toBe("PLAID");
    expect(categoryUsage.estimatedRemainingCents).toBe(500);
    expect(unknownUsage.status).toBe("UNKNOWN");
    expect(forbidden.statusCode).toBe(404);

    await server.close();
  });
});

let creditFixtureCounter = 0;

async function createCreditFixture(
  kind: "merchant" | "category" | "unknown",
  source: "MANUAL" | "PLAID" = "MANUAL",
) {
  const fixtureId = `${kind}-${source.toLowerCase()}-${creditFixtureCounter++}`;
  const [user, card, merchant] = await Promise.all([
    prisma.user.upsert({
      where: { email: `phase12-credit-${fixtureId}@example.com` },
      update: {},
      create: { email: `phase12-credit-${fixtureId}@example.com` },
    }),
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
  ]);
  const userCard = await prisma.userCard.upsert({
    where: { userId_cardId: { userId: user.id, cardId: card.id } },
    update: { isActive: true },
    create: { userId: user.id, cardId: card.id, isActive: true },
  });
  await prisma.entitlementGrant.create({
    data: {
      userId: user.id,
      key: "STATEMENT_CREDIT_TRACKING",
      source: "MANUAL_GRANT",
      notes: "Test grant for statement credit usage endpoints.",
    },
  });
  const periodStartDate = new Date(Date.UTC(2600, 0, 1));
  periodStartDate.setUTCDate(
    periodStartDate.getUTCDate() +
      creditFixtureCounter * 31 +
      Math.floor(Math.random() * 1_000_000),
  );
  const periodEndDate = new Date(periodStartDate);
  periodEndDate.setUTCDate(periodEndDate.getUTCDate() + 31);
  const transactionDate = new Date(periodStartDate);
  transactionDate.setUTCDate(transactionDate.getUTCDate() + 10);
  const periodStart = periodStartDate.toISOString();
  const periodEnd = periodEndDate.toISOString();
  const credit = await prisma.statementCredit.create({
    data: {
      cardId: card.id,
      name: `Phase 12 ${kind} credit ${Math.random()}`,
      description: "Phase 12 usage fixture.",
      amountCents: 1000,
      recurrence: "MONTHLY",
      confidence: "HIGH",
      merchantId: kind === "merchant" ? merchant.id : null,
      category: kind === "category" ? "STREAMING" : null,
    },
  });

  if (kind !== "unknown") {
    await prisma.transaction.create({
      data: {
        userId: user.id,
        userCardId: userCard.id,
        merchantId: merchant.id,
        rawMerchantName: "STARBUCKS",
        normalizedMerchantName: "starbucks",
        amountCents: kind === "merchant" ? 1200 : 500,
        transactionDate,
        source,
        externalId: `phase12-${kind}-${source}-${Math.random()}`,
        observedCategory: kind === "category" ? "STREAMING" : "DINING",
      },
    });
  }

  return { user, userCard, credit, periodStart, periodEnd };
}

async function createAdminUsage() {
  const fixture = await createCreditFixture("unknown");
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@example.com" },
  });
  return prisma.statementCreditUsage.create({
    data: {
      userId: admin.id,
      userCardId: fixture.userCard.id,
      statementCreditId: fixture.credit.id,
      periodStart: new Date("2502-01-01T00:00:00.000Z"),
      periodEnd: new Date("2502-02-01T00:00:00.000Z"),
      status: "UNKNOWN",
      source: "GENERATED",
    },
  });
}
