import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  setPlaidClientForTesting,
  type PlaidClient,
} from "../src/services/plaidClient.js";
import { buildSeededServer, prisma } from "./testUtils.js";

describe("Plaid private beta API", () => {
  const originalKey = process.env.SECRET_ENCRYPTION_KEY;
  let fakePlaid: PlaidClient;

  beforeEach(() => {
    process.env.SECRET_ENCRYPTION_KEY = "phase-11-test-secret";
    fakePlaid = createFakePlaidClient();
    setPlaidClientForTesting(fakePlaid);
  });

  afterEach(() => {
    setPlaidClientForTesting(null);
    vi.restoreAllMocks();
    if (originalKey === undefined) {
      delete process.env.SECRET_ENCRYPTION_KEY;
    } else {
      process.env.SECRET_ENCRYPTION_KEY = originalKey;
    }
  });

  it("beta-gates link token creation", async () => {
    const server = await buildSeededServer();
    const user = await prisma.user.upsert({
      where: { email: "plaid-nonbeta@example.com" },
      update: { plaidBetaEnabled: false },
      create: {
        email: "plaid-nonbeta@example.com",
        plaidBetaEnabled: false,
      },
    });

    const denied = await server.inject({
      method: "POST",
      url: "/v1/plaid/link-token",
      headers: { "x-user-email": user.email },
    });
    await createPlaidConsent();
    const allowed = await server.inject({
      method: "POST",
      url: "/v1/plaid/link-token",
    });

    expect(denied.statusCode).toBe(403);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().linkToken).toBe("link-sandbox-test");

    await server.close();
  }, 15_000);

  it("stores encrypted connection and accounts without returning access token", async () => {
    const server = await buildSeededServer();

    const response = await server.inject({
      method: "POST",
      url: "/v1/plaid/exchange-public-token",
      payload: {
        publicToken: "public-sandbox-test",
        metadata: {
          institution: {
            institution_id: "ins_1",
            name: "Sandbox Bank",
          },
        },
      },
    });
    const bodyText = response.body;
    const connection = await prisma.plaidConnection.findUniqueOrThrow({
      where: { itemId: "item-sandbox-test" },
      include: { accounts: true },
    });

    expect(response.statusCode).toBe(200);
    expect(connection.accessTokenEncrypted).not.toContain(
      "access-sandbox-test",
    );
    expect(connection.accounts).toHaveLength(1);
    expect(bodyText).not.toContain("access-sandbox-test");

    await server.close();
  });

  it("returns status and links Plaid account to an owned wallet card", async () => {
    const server = await buildSeededServer();
    await exchangePublicToken(server);
    const account = await prisma.plaidAccount.findFirstOrThrow({
      where: { accountId: "plaid-account-1" },
    });
    const userCard = await betaUserCard("chase-freedom-unlimited");

    const linked = await server.inject({
      method: "PATCH",
      url: `/v1/plaid/accounts/${account.id}/link-card`,
      payload: { userCardId: userCard.id },
    });
    const status = await server.inject({
      method: "GET",
      url: "/v1/plaid/status",
    });

    expect(linked.statusCode).toBe(200);
    expect(status.statusCode).toBe(200);
    expect(status.json().betaEnabled).toBe(true);
    expect(status.json().connections[0].accounts[0].linkedUserCard.id).toBe(
      userCard.id,
    );

    await server.close();
  });

  it("syncs Plaid transactions, dedupes, maps card/category/merchant, and audits", async () => {
    const server = await buildSeededServer();
    await exchangePublicToken(server);
    const account = await prisma.plaidAccount.findFirstOrThrow({
      where: { accountId: "plaid-account-1" },
    });
    const userCard = await betaUserCard("chase-freedom-unlimited");
    await prisma.plaidAccount.update({
      where: { id: account.id },
      data: { linkedUserCardId: userCard.id },
    });
    const connection = await prisma.plaidConnection.findUniqueOrThrow({
      where: { itemId: "item-sandbox-test" },
    });

    const first = await server.inject({
      method: "POST",
      url: `/v1/plaid/connections/${connection.id}/sync`,
      payload: { audit: true },
    });
    const second = await server.inject({
      method: "POST",
      url: `/v1/plaid/connections/${connection.id}/sync`,
      payload: { audit: false },
    });
    const transaction = await prisma.transaction.findFirstOrThrow({
      where: { source: "PLAID", externalId: "plaid-transaction-1" },
      include: { outcomes: true, merchant: true },
    });
    const refreshedConnection = await prisma.plaidConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().importedTransactionCount).toBe(1);
    expect(first.json().auditedTransactionCount).toBe(1);
    expect(second.statusCode).toBe(200);
    expect(transaction.userCardId).toBe(userCard.id);
    expect(transaction.observedCategory).toBe("DINING");
    expect(transaction.merchant?.slug).toBe("starbucks");
    expect(transaction.outcomes.length).toBeGreaterThan(0);
    expect(refreshedConnection.cursor).toBe("cursor-next");

    await server.close();
  });

  it("records failed sync runs with sanitized errors", async () => {
    fakePlaid.syncTransactions = vi.fn(async () => {
      throw new Error("sandbox sync failed");
    });
    const server = await buildSeededServer();
    await exchangePublicToken(server);
    const connection = await prisma.plaidConnection.findUniqueOrThrow({
      where: { itemId: "item-sandbox-test" },
    });

    const response = await server.inject({
      method: "POST",
      url: `/v1/plaid/connections/${connection.id}/sync`,
    });
    const syncRun = await prisma.plaidSyncRun.findFirstOrThrow({
      where: { plaidConnectionId: connection.id },
      orderBy: { createdAt: "desc" },
    });

    expect(response.statusCode).toBe(400);
    expect(syncRun.status).toBe("FAILED");
    expect(syncRun.errorMessage).toBe("sandbox sync failed");

    await server.close();
  });

  it("disconnects and delete-data leaves manual transactions intact", async () => {
    const server = await buildSeededServer();
    await exchangePublicToken(server);
    const connection = await prisma.plaidConnection.findUniqueOrThrow({
      where: { itemId: "item-sandbox-test" },
    });
    const manual = await prisma.transaction.create({
      data: {
        userId: connection.userId,
        rawMerchantName: `Manual Coffee ${Date.now()}`,
        amountCents: 1000,
        transactionDate: new Date(),
        source: "MANUAL",
      },
    });

    const disconnect = await server.inject({
      method: "DELETE",
      url: `/v1/plaid/connections/${connection.id}`,
      payload: { deleteTransactions: false },
    });
    const deleteData = await server.inject({
      method: "DELETE",
      url: "/v1/plaid/data",
    });
    const manualCount = await prisma.transaction.count({
      where: { id: manual.id },
    });

    expect(disconnect.statusCode).toBe(200);
    expect(fakePlaid.removeItem).toHaveBeenCalled();
    expect(deleteData.statusCode).toBe(200);
    expect(manualCount).toBe(1);

    await server.close();
  });

  it("accepts basic webhooks and rejects malformed payloads", async () => {
    const server = await buildSeededServer();

    const ok = await server.inject({
      method: "POST",
      url: "/v1/plaid/webhook",
      payload: { webhook_type: "TRANSACTIONS", item_id: "item-sandbox-test" },
    });
    const bad = await server.inject({
      method: "POST",
      url: "/v1/plaid/webhook",
      payload: null,
    });

    expect(ok.statusCode).toBe(200);
    expect(bad.statusCode).toBe(400);

    await server.close();
  });
});

function createFakePlaidClient(): PlaidClient {
  return {
    createLinkToken: vi.fn(async () => ({
      link_token: "link-sandbox-test",
      expiration: "2026-01-01T00:00:00Z",
    })),
    exchangePublicToken: vi.fn(async () => ({
      access_token: "access-sandbox-test",
      item_id: "item-sandbox-test",
    })),
    getAccounts: vi.fn(async () => [
      {
        account_id: "plaid-account-1",
        name: "Sandbox Visa",
        official_name: "Sandbox Visa Credit",
        mask: "1234",
        type: "credit",
        subtype: "credit card",
      },
    ]),
    syncTransactions: vi.fn(async () => ({
      added: [
        {
          transaction_id: "plaid-transaction-1",
          account_id: "plaid-account-1",
          name: "STARBUCKS STORE #1234",
          merchant_name: "Starbucks",
          amount: 50,
          iso_currency_code: "USD",
          date: "2026-01-04",
          authorized_date: "2026-01-03",
          pending: false,
          category: ["Food and Drink", "Restaurants"],
          payment_channel: "in store",
        },
      ],
      modified: [],
      removed: [],
      next_cursor: "cursor-next",
      accounts: [],
    })),
    removeItem: vi.fn(async () => undefined),
  };
}

async function exchangePublicToken(
  server: Awaited<ReturnType<typeof buildSeededServer>>,
) {
  await createPlaidConsent();
  return server.inject({
    method: "POST",
    url: "/v1/plaid/exchange-public-token",
    payload: {
      publicToken: "public-sandbox-test",
      metadata: {
        institution: {
          institution_id: "ins_1",
          name: "Sandbox Bank",
        },
      },
    },
  });
}

async function createPlaidConsent() {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "beta@example.com" },
  });
  return prisma.consentRecord.upsert({
    where: { id: "test-beta-plaid-consent" },
    update: { revokedAt: null },
    create: {
      id: "test-beta-plaid-consent",
      userId: user.id,
      consentType: "PLAID_TRANSACTIONS",
      version: "test-v1",
      grantedAt: new Date(),
    },
  });
}

async function betaUserCard(cardSlug: string) {
  const [user, card] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "beta@example.com" } }),
    prisma.card.findUniqueOrThrow({ where: { slug: cardSlug } }),
  ]);

  return prisma.userCard.upsert({
    where: { userId_cardId: { userId: user.id, cardId: card.id } },
    update: { isActive: true },
    create: { userId: user.id, cardId: card.id, isActive: true },
  });
}
