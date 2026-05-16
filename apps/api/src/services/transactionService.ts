import type { Prisma, TransactionSource, User } from "@prisma/client";
import { normalizeMerchantName } from "@rewards-audit/rewards-engine";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import type { ImportTransactionsInput } from "../schemas/transactions.js";
import { auditTransaction } from "./auditService.js";
import { findMerchantByTransactionName } from "./transactionMerchantService.js";

const transactionInclude = {
  merchant: true,
  userCard: {
    include: {
      card: {
        include: { issuer: true },
      },
    },
  },
  outcomes: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
  },
} satisfies Prisma.TransactionInclude;

export async function importTransactions(
  user: User,
  input: ImportTransactionsInput,
) {
  const imported = [];

  for (const transactionInput of input.transactions) {
    if (transactionInput.userCardId) {
      await assertOwnsUserCard(user.id, transactionInput.userCardId);
    }

    const existing =
      transactionInput.externalId &&
      (await prisma.transaction.findFirst({
        where: {
          userId: user.id,
          source: input.source,
          externalId: transactionInput.externalId,
        },
        include: transactionInclude,
      }));

    if (existing) {
      const outcome = input.audit
        ? await auditTransaction(user, existing.id)
        : undefined;
      imported.push({ transaction: existing, status: "existing", outcome });
      continue;
    }

    const normalizedMerchantName = normalizeMerchantName(
      transactionInput.rawMerchantName,
    );
    const merchant = await findMerchantByTransactionName(
      normalizedMerchantName,
    );
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        userCardId: transactionInput.userCardId ?? null,
        merchantId: merchant?.id ?? null,
        rawMerchantName: transactionInput.rawMerchantName,
        normalizedMerchantName,
        amountCents: transactionInput.amountCents,
        currencyCode: "USD",
        transactionDate: new Date(transactionInput.transactionDate),
        postedDate: transactionInput.postedDate
          ? new Date(transactionInput.postedDate)
          : null,
        source: input.source,
        externalId: transactionInput.externalId ?? null,
        observedCategory: transactionInput.observedCategory ?? null,
        observedMcc: transactionInput.observedMcc ?? null,
        rawData: transactionInput.rawData as Prisma.InputJsonValue,
      },
      include: transactionInclude,
    });
    const outcome = input.audit
      ? await auditTransaction(user, transaction.id)
      : undefined;

    imported.push({ transaction, status: "created", outcome });
  }

  return {
    imported,
    createdCount: imported.filter((item) => item.status === "created").length,
    existingCount: imported.filter((item) => item.status === "existing").length,
    auditedCount: imported.filter((item) => item.outcome).length,
  };
}

export async function listTransactions(
  user: User,
  input: {
    limit: number;
    source?: TransactionSource | undefined;
    merchantId?: string | undefined;
    userCardId?: string | undefined;
  },
) {
  return prisma.transaction.findMany({
    where: {
      userId: user.id,
      ...(input.source ? { source: input.source } : {}),
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.userCardId ? { userCardId: input.userCardId } : {}),
    },
    include: transactionInclude,
    orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

export async function getTransaction(user: User, id: string) {
  const transaction = await prisma.transaction.findFirst({
    where: { id, userId: user.id },
    include: {
      ...transactionInclude,
      outcomes: {
        include: {
          recommendationEvent: true,
          actualUserCard: true,
          bestUserCard: true,
          recommendedUserCard: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      },
    },
  });

  if (!transaction) {
    throw notFound("Transaction was not found for the current user.");
  }

  return transaction;
}

async function assertOwnsUserCard(
  userId: string,
  userCardId: string,
): Promise<void> {
  const userCard = await prisma.userCard.findFirst({
    where: {
      id: userCardId,
      userId,
    },
  });

  if (!userCard) {
    throw notFound("Wallet card was not found for the current user.");
  }
}
