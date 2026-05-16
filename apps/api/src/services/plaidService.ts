import type {
  PlaidAccount,
  PlaidConnection,
  PlaidSyncRun,
  Prisma,
  User,
} from "@prisma/client";
import { normalizeMerchantName } from "@rewards-audit/rewards-engine";

import { prisma } from "@rewards-audit/db";

import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import { badRequest, forbidden, notFound } from "../lib/httpErrors.js";
import { auditTransaction } from "./auditService.js";
import { captureException } from "./observability/errorReporter.js";
import { mapPlaidTransactionToMerchantCategory } from "./plaidCategoryMapper.js";
import {
  getPlaidClient,
  type PlaidAccountDto,
  type PlaidTransactionDto,
} from "./plaidClient.js";
import { findMerchantByTransactionName } from "./transactionMerchantService.js";

type PublicTokenMetadata = {
  institution?:
    | {
        institution_id?: string | null | undefined;
        name?: string | null | undefined;
      }
    | null
    | undefined;
};

type SyncOptions = {
  audit?: boolean;
};

const plaidStatusInclude = {
  accounts: {
    include: {
      linkedUserCard: {
        include: {
          card: {
            include: { issuer: true },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.PlaidConnectionInclude;

export async function createPlaidLinkToken(user: User) {
  requirePlaidBeta(user);
  const result = await getPlaidClient().createLinkToken({
    userId: user.id,
    clientUserId: user.id,
  });

  return {
    linkToken: result.link_token,
    expiration: result.expiration ?? null,
  };
}

export async function exchangePlaidPublicToken(
  user: User,
  publicToken: string,
  metadata?: PublicTokenMetadata,
) {
  requirePlaidBeta(user);
  const client = getPlaidClient();
  const exchanged = await client.exchangePublicToken(publicToken);
  const existing = await prisma.plaidConnection.findUnique({
    where: { itemId: exchanged.item_id },
  });

  if (existing && existing.userId !== user.id) {
    throw forbidden("This Plaid item is already linked to another user.");
  }

  const connection = await prisma.plaidConnection.upsert({
    where: { itemId: exchanged.item_id },
    update: {
      userId: user.id,
      accessTokenEncrypted: encryptSecret(exchanged.access_token),
      institutionId: metadata?.institution?.institution_id ?? null,
      institutionName: metadata?.institution?.name ?? null,
      status: "ACTIVE",
      errorCode: null,
      errorMessage: null,
    },
    create: {
      userId: user.id,
      itemId: exchanged.item_id,
      accessTokenEncrypted: encryptSecret(exchanged.access_token),
      institutionId: metadata?.institution?.institution_id ?? null,
      institutionName: metadata?.institution?.name ?? null,
      status: "ACTIVE",
    },
  });
  const accounts = await client.getAccounts(exchanged.access_token);

  await upsertPlaidAccounts(user.id, connection.id, accounts);

  return getPlaidConnectionForUser(user.id, connection.id);
}

export async function getPlaidStatus(user: User) {
  const connections = await prisma.plaidConnection.findMany({
    where: { userId: user.id },
    include: plaidStatusInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return {
    betaEnabled: user.plaidBetaEnabled,
    connections: connections.map(stripConnectionSecret),
  };
}

export async function linkPlaidAccountToUserCard(
  user: User,
  plaidAccountId: string,
  userCardId: string,
) {
  requirePlaidBeta(user);
  const [account, userCard] = await Promise.all([
    prisma.plaidAccount.findFirst({
      where: { id: plaidAccountId, userId: user.id },
    }),
    prisma.userCard.findFirst({
      where: { id: userCardId, userId: user.id },
      include: { card: { include: { issuer: true } } },
    }),
  ]);

  if (!account) {
    throw notFound("Plaid account was not found for the current user.");
  }
  if (!userCard) {
    throw notFound("Wallet card was not found for the current user.");
  }

  return prisma.plaidAccount.update({
    where: { id: plaidAccountId },
    data: { linkedUserCardId: userCardId },
    include: {
      linkedUserCard: {
        include: {
          card: {
            include: { issuer: true },
          },
        },
      },
    },
  });
}

export async function syncPlaidConnection(
  user: User,
  plaidConnectionId: string,
  options: SyncOptions = {},
) {
  requirePlaidBeta(user);
  const connection = await prisma.plaidConnection.findFirst({
    where: {
      id: plaidConnectionId,
      userId: user.id,
      status: "ACTIVE",
    },
    include: { accounts: true },
  });

  if (!connection) {
    throw notFound(
      "Active Plaid connection was not found for the current user.",
    );
  }

  const syncRun = await prisma.plaidSyncRun.create({
    data: {
      userId: user.id,
      plaidConnectionId,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  try {
    const accessToken = decryptSecret(connection.accessTokenEncrypted);
    const syncResult = await getPlaidClient().syncTransactions(
      accessToken,
      connection.cursor,
    );

    if (syncResult.accounts) {
      await upsertPlaidAccounts(user.id, connection.id, syncResult.accounts);
    }

    const currentAccounts = await prisma.plaidAccount.findMany({
      where: { plaidConnectionId: connection.id, userId: user.id },
    });
    const accountsByPlaidId = new Map(
      currentAccounts.map((account) => [account.accountId, account]),
    );
    const importedTransactionIds: string[] = [];

    for (const transaction of [...syncResult.added, ...syncResult.modified]) {
      const imported = await upsertPlaidTransaction(
        user,
        connection,
        accountsByPlaidId,
        transaction,
      );

      if (imported) {
        importedTransactionIds.push(imported.id);
      }
    }

    let auditedTransactionCount = 0;
    if (options.audit ?? true) {
      for (const transactionId of importedTransactionIds) {
        await auditTransaction(user, transactionId);
        auditedTransactionCount += 1;
      }
    }

    const finishedAt = new Date();
    await prisma.plaidConnection.update({
      where: { id: connection.id },
      data: {
        cursor: syncResult.next_cursor ?? connection.cursor,
        lastSyncedAt: finishedAt,
        status: "ACTIVE",
        errorCode: null,
        errorMessage: null,
      },
    });

    return prisma.plaidSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "SUCCEEDED",
        finishedAt,
        addedCount: syncResult.added.length,
        modifiedCount: syncResult.modified.length,
        removedCount: syncResult.removed.length,
        importedTransactionCount: importedTransactionIds.length,
        auditedTransactionCount,
      },
    });
  } catch (error) {
    const sanitized = sanitizePlaidError(error);
    captureException(error, {
      userId: user.id,
      plaidConnectionId,
      syncRunId: syncRun.id,
      errorCode: sanitized.code,
    });
    const finishedAt = new Date();
    await prisma.plaidConnection.update({
      where: { id: connection.id },
      data: {
        status: "ERROR",
        errorCode: sanitized.code,
        errorMessage: sanitized.message,
      },
    });

    await prisma.plaidSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        finishedAt,
        errorCode: sanitized.code,
        errorMessage: sanitized.message,
      },
    });

    throw badRequest(`Plaid sync failed: ${sanitized.message}`);
  }
}

export async function syncAllPlaidConnections(
  user: User,
  options: SyncOptions = {},
) {
  requirePlaidBeta(user);
  const connections = await prisma.plaidConnection.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const runs: PlaidSyncRun[] = [];

  for (const connection of connections) {
    runs.push(await syncPlaidConnection(user, connection.id, options));
  }

  return {
    runs,
    addedCount: sum(runs, "addedCount"),
    modifiedCount: sum(runs, "modifiedCount"),
    removedCount: sum(runs, "removedCount"),
    importedTransactionCount: sum(runs, "importedTransactionCount"),
    auditedTransactionCount: sum(runs, "auditedTransactionCount"),
  };
}

export async function disconnectPlaidConnection(
  user: User,
  plaidConnectionId: string,
  options: { deleteTransactions?: boolean } = {},
) {
  requirePlaidBeta(user);
  const connection = await prisma.plaidConnection.findFirst({
    where: { id: plaidConnectionId, userId: user.id },
    include: { accounts: true },
  });

  if (!connection) {
    throw notFound("Plaid connection was not found for the current user.");
  }

  if (connection.status === "ACTIVE" || connection.status === "ERROR") {
    await getPlaidClient().removeItem(
      decryptSecret(connection.accessTokenEncrypted),
    );
  }

  const deleted = options.deleteTransactions
    ? await deletePlaidTransactionsForConnection(user.id, connection)
    : { deletedTransactionCount: 0, deletedOutcomeCount: 0 };

  const updated = await prisma.plaidConnection.update({
    where: { id: connection.id },
    data: {
      status: "DISCONNECTED",
      accessTokenEncrypted: encryptSecret("DISCONNECTED"),
      cursor: null,
    },
    include: plaidStatusInclude,
  });

  return {
    connection: stripConnectionSecret(updated),
    ...deleted,
  };
}

export async function deletePlaidData(user: User) {
  requirePlaidBeta(user);
  const connections = await prisma.plaidConnection.findMany({
    where: { userId: user.id },
  });
  let disconnectedCount = 0;

  for (const connection of connections) {
    if (connection.status !== "DISCONNECTED") {
      try {
        await getPlaidClient().removeItem(
          decryptSecret(connection.accessTokenEncrypted),
        );
      } catch {
        // Best effort remote disconnect; local data deletion continues.
      }
      disconnectedCount += 1;
    }
  }

  const deleted = await deleteAllPlaidTransactionsForUser(user.id);
  await prisma.plaidAccount.deleteMany({ where: { userId: user.id } });
  await prisma.plaidConnection.updateMany({
    where: { userId: user.id },
    data: {
      status: "DISCONNECTED",
      accessTokenEncrypted: encryptSecret("DISCONNECTED"),
      cursor: null,
    },
  });

  return {
    disconnectedCount,
    ...deleted,
  };
}

export async function handlePlaidWebhook(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw badRequest("Invalid Plaid webhook payload.");
  }

  return { ok: true };
}

function requirePlaidBeta(user: User): void {
  if (!user.plaidBetaEnabled) {
    throw forbidden("Plaid private beta is not enabled for this account.");
  }
}

async function getPlaidConnectionForUser(userId: string, connectionId: string) {
  const connection = await prisma.plaidConnection.findFirstOrThrow({
    where: { id: connectionId, userId },
    include: plaidStatusInclude,
  });

  return {
    connection: stripConnectionSecret(connection),
    accounts: connection.accounts,
  };
}

async function upsertPlaidAccounts(
  userId: string,
  plaidConnectionId: string,
  accounts: PlaidAccountDto[],
): Promise<void> {
  for (const account of accounts) {
    await prisma.plaidAccount.upsert({
      where: {
        plaidConnectionId_accountId: {
          plaidConnectionId,
          accountId: account.account_id,
        },
      },
      update: {
        userId,
        name: account.name,
        officialName: account.official_name ?? null,
        mask: account.mask ?? null,
        type: account.type ?? null,
        subtype: account.subtype ?? null,
      },
      create: {
        userId,
        plaidConnectionId,
        accountId: account.account_id,
        name: account.name,
        officialName: account.official_name ?? null,
        mask: account.mask ?? null,
        type: account.type ?? null,
        subtype: account.subtype ?? null,
      },
    });
  }
}

async function upsertPlaidTransaction(
  user: User,
  connection: PlaidConnection,
  accountsByPlaidId: Map<string, PlaidAccount>,
  plaidTransaction: PlaidTransactionDto,
) {
  if (plaidTransaction.pending || plaidTransaction.amount <= 0) {
    return null;
  }

  const plaidAccount = accountsByPlaidId.get(plaidTransaction.account_id);
  const rawMerchantName =
    plaidTransaction.merchant_name ?? plaidTransaction.name ?? "Unknown";
  const normalizedMerchantName = normalizeMerchantName(rawMerchantName);
  const merchant = await findMerchantByTransactionName(normalizedMerchantName);
  const amountCents = Math.round(Math.abs(plaidTransaction.amount) * 100);
  const transactionDate = new Date(
    plaidTransaction.authorized_date ?? plaidTransaction.date,
  );
  const postedDate = new Date(plaidTransaction.date);
  const observedCategory =
    mapPlaidTransactionToMerchantCategory(plaidTransaction);
  const rawData = {
    plaidConnectionId: connection.id,
    plaidAccountId: plaidAccount?.id ?? null,
    accountId: plaidTransaction.account_id,
    category: plaidTransaction.category ?? null,
    personalFinanceCategory: plaidTransaction.personal_finance_category ?? null,
    paymentChannel: plaidTransaction.payment_channel ?? null,
    pending: plaidTransaction.pending ?? false,
    merchantName: plaidTransaction.merchant_name ?? null,
  } satisfies Prisma.InputJsonObject;
  const existing = await prisma.transaction.findFirst({
    where: {
      userId: user.id,
      source: "PLAID",
      externalId: plaidTransaction.transaction_id,
    },
  });
  const data = {
    userId: user.id,
    userCardId: plaidAccount?.linkedUserCardId ?? null,
    merchantId: merchant?.id ?? null,
    rawMerchantName,
    normalizedMerchantName,
    amountCents,
    currencyCode: plaidTransaction.iso_currency_code ?? "USD",
    transactionDate,
    postedDate,
    source: "PLAID" as const,
    externalId: plaidTransaction.transaction_id,
    observedCategory,
    observedMcc: null,
    rawData,
  };

  if (existing) {
    return prisma.transaction.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.transaction.create({ data });
}

async function deletePlaidTransactionsForConnection(
  userId: string,
  connection: PlaidConnection & { accounts: PlaidAccount[] },
) {
  const plaidAccountIds = new Set(
    connection.accounts.map((account) => account.id),
  );
  const transactions = await prisma.transaction.findMany({
    where: { userId, source: "PLAID" },
    select: { id: true, rawData: true },
  });
  const transactionIds = transactions
    .filter((transaction) => {
      const rawData = transaction.rawData;
      return (
        rawData &&
        typeof rawData === "object" &&
        !Array.isArray(rawData) &&
        plaidAccountIds.has(String(rawData.plaidAccountId))
      );
    })
    .map((transaction) => transaction.id);

  return deleteTransactionsByIds(transactionIds);
}

async function deleteAllPlaidTransactionsForUser(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { userId, source: "PLAID" },
    select: { id: true },
  });

  return deleteTransactionsByIds(
    transactions.map((transaction) => transaction.id),
  );
}

async function deleteTransactionsByIds(transactionIds: string[]) {
  if (transactionIds.length === 0) {
    return { deletedTransactionCount: 0, deletedOutcomeCount: 0 };
  }

  const deletedOutcomes = await prisma.recommendationOutcome.deleteMany({
    where: { transactionId: { in: transactionIds } },
  });
  const deletedTransactions = await prisma.transaction.deleteMany({
    where: { id: { in: transactionIds } },
  });

  return {
    deletedTransactionCount: deletedTransactions.count,
    deletedOutcomeCount: deletedOutcomes.count,
  };
}

function stripConnectionSecret<T extends PlaidConnection>(connection: T) {
  const safeConnection = { ...connection };
  delete (safeConnection as Partial<PlaidConnection>).accessTokenEncrypted;

  return safeConnection;
}

function sanitizePlaidError(error: unknown): {
  code: string;
  message: string;
} {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const response = record.response as
      | { data?: { error_code?: string; error_message?: string } }
      | undefined;

    return {
      code: response?.data?.error_code ?? "PLAID_SYNC_FAILED",
      message:
        response?.data?.error_message ??
        (typeof record.message === "string"
          ? record.message
          : "Plaid sync failed."),
    };
  }

  return { code: "PLAID_SYNC_FAILED", message: "Plaid sync failed." };
}

function sum(runs: PlaidSyncRun[], key: keyof PlaidSyncRun): number {
  return runs.reduce((total, run) => {
    const value = run[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}
