import type {
  Prisma,
  Recurrence,
  MerchantCategory,
  StatementCreditUsageSource,
  StatementCreditUsageStatus,
  TransactionSource,
  User,
} from "@prisma/client";
import { computeStatementCreditPeriod } from "@rewards-audit/rewards-engine";

import { prisma } from "@rewards-audit/db";

import { badRequest, notFound } from "../lib/httpErrors.js";

const usageInclude = {
  userCard: {
    include: {
      card: {
        include: { issuer: true },
      },
    },
  },
  statementCredit: {
    include: {
      merchant: true,
    },
  },
} satisfies Prisma.StatementCreditUsageInclude;

const walletCreditInclude = {
  card: {
    include: {
      issuer: true,
      statementCredits: true,
    },
  },
} satisfies Prisma.UserCardInclude;

type WalletCardWithCredits = Prisma.UserCardGetPayload<{
  include: typeof walletCreditInclude;
}>;

export async function listStatementCreditUsage(
  user: User,
  input: {
    userCardId?: string | undefined;
    statementCreditId?: string | undefined;
    status?: StatementCreditUsageStatus | undefined;
    periodStart?: string | undefined;
    periodEnd?: string | undefined;
    limit: number;
  },
) {
  const where: Prisma.StatementCreditUsageWhereInput = {
    userId: user.id,
  };
  if (input.userCardId) where.userCardId = input.userCardId;
  if (input.statementCreditId)
    where.statementCreditId = input.statementCreditId;
  if (input.status) where.status = input.status;
  if (input.periodStart)
    where.periodStart = { gte: new Date(input.periodStart) };
  if (input.periodEnd) where.periodEnd = { lte: new Date(input.periodEnd) };

  return prisma.statementCreditUsage.findMany({
    where,
    include: usageInclude,
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function updateStatementCreditUsage(
  user: User,
  usageId: string,
  input: {
    status?: StatementCreditUsageStatus | undefined;
    amountUsedCents?: number | null | undefined;
    estimatedRemainingCents?: number | null | undefined;
    notes?: string | null | undefined;
  },
) {
  const usage = await prisma.statementCreditUsage.findFirst({
    where: { id: usageId, userId: user.id },
  });
  if (!usage) {
    throw notFound("Statement credit usage record not found.");
  }

  const data: Prisma.StatementCreditUsageUpdateInput = {
    source: "MANUAL",
  };
  if (input.status !== undefined) data.status = input.status;
  if (input.amountUsedCents !== undefined) {
    data.amountUsedCents = input.amountUsedCents;
  }
  if (input.estimatedRemainingCents !== undefined) {
    data.estimatedRemainingCents = input.estimatedRemainingCents;
  }
  if (input.notes !== undefined) data.notes = input.notes;

  return prisma.statementCreditUsage.update({
    where: { id: usageId },
    data,
    include: usageInclude,
  });
}

export async function generateStatementCreditUsage(
  user: User,
  input: {
    userCardId?: string | undefined;
    periodStart?: string | undefined;
    periodEnd?: string | undefined;
    inferFromTransactions: boolean;
  },
) {
  const walletWhere: Prisma.UserCardWhereInput = {
    userId: user.id,
    isActive: true,
  };
  if (input.userCardId) walletWhere.id = input.userCardId;

  const wallet: WalletCardWithCredits[] = await prisma.userCard.findMany({
    where: walletWhere,
    include: walletCreditInclude,
  });

  if (input.userCardId && wallet.length === 0) {
    throw notFound("User card not found.");
  }

  let generatedCount = 0;
  let updatedCount = 0;
  const usageRecords = [];

  for (const userCard of wallet) {
    for (const credit of userCard.card.statementCredits) {
      const period =
        input.periodStart && input.periodEnd
          ? {
              periodStart: new Date(input.periodStart),
              periodEnd: new Date(input.periodEnd),
            }
          : computeStatementCreditPeriod(
              recurrenceForPeriod(credit.recurrence),
              new Date(),
            );

      if (period.periodStart >= period.periodEnd) {
        throw badRequest("periodStart must be before periodEnd.");
      }

      const inference = input.inferFromTransactions
        ? await inferUsage(user.id, userCard.id, credit, period)
        : unknownUsage(credit.amountCents);

      const existing = await prisma.statementCreditUsage.findUnique({
        where: {
          userCardId_statementCreditId_periodStart_periodEnd: {
            userCardId: userCard.id,
            statementCreditId: credit.id,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
          },
        },
      });

      const record = await prisma.statementCreditUsage.upsert({
        where: {
          userCardId_statementCreditId_periodStart_periodEnd: {
            userCardId: userCard.id,
            statementCreditId: credit.id,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
          },
        },
        create: {
          userId: user.id,
          userCardId: userCard.id,
          statementCreditId: credit.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          ...inference,
        },
        update: inference,
        include: usageInclude,
      });

      generatedCount += existing ? 0 : 1;
      updatedCount += existing ? 1 : 0;
      usageRecords.push(record);
    }
  }

  return { generatedCount, updatedCount, usageRecords };
}

async function inferUsage(
  userId: string,
  userCardId: string,
  credit: {
    id: string;
    amountCents: number;
    merchantId: string | null;
    category: MerchantCategory | null;
  },
  period: { periodStart: Date; periodEnd: Date },
) {
  if (!credit.merchantId && !credit.category) {
    return unknownUsage(
      credit.amountCents,
      "No merchant or category matching rule is available for this credit.",
    );
  }

  const transactionWhere: Prisma.TransactionWhereInput = {
    userId,
    userCardId,
    transactionDate: { gte: period.periodStart, lt: period.periodEnd },
  };
  if (credit.merchantId) {
    transactionWhere.merchantId = credit.merchantId;
  } else if (credit.category) {
    transactionWhere.observedCategory = credit.category;
  }

  const transactions = await prisma.transaction.findMany({
    where: transactionWhere,
    orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
  });
  const amountUsedCents = Math.min(
    credit.amountCents,
    transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0),
  );
  const estimatedRemainingCents = Math.max(
    0,
    credit.amountCents - amountUsedCents,
  );
  const status = usageStatus(amountUsedCents, credit.amountCents);

  return {
    status,
    amountUsedCents,
    estimatedRemainingCents,
    source: usageSource(transactions.map((transaction) => transaction.source)),
    matchedTransactionIds: transactions.map((transaction) => transaction.id),
    evidence: {
      matchingStrategy: credit.merchantId ? "MERCHANT" : "CATEGORY",
      caveat:
        "Estimated from matching transactions; this does not prove the issuer posted a statement credit.",
    },
  };
}

function unknownUsage(amountCents: number, caveat?: string) {
  return {
    status: "UNKNOWN" as const,
    amountUsedCents: null,
    estimatedRemainingCents: amountCents,
    source: "GENERATED" as const,
    matchedTransactionIds: [],
    evidence: {
      caveat:
        caveat ??
        "No transaction inference was requested; usage status needs manual review.",
    },
  };
}

function usageStatus(
  amountUsedCents: number,
  amountCents: number,
): StatementCreditUsageStatus {
  if (amountUsedCents >= amountCents) return "USED";
  if (amountUsedCents > 0) return "PARTIALLY_USED";
  return "UNUSED";
}

function usageSource(sources: TransactionSource[]): StatementCreditUsageSource {
  if (sources.length === 0) return "GENERATED";
  if (sources.every((source) => source === "PLAID")) return "PLAID";
  if (
    sources.every((source) => source === "MANUAL" || source === "CSV_IMPORT")
  ) {
    return "IMPORTED_TRANSACTION";
  }
  return "TRANSACTION_AUDIT";
}

function recurrenceForPeriod(
  recurrence: Recurrence,
): "NONE" | "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" {
  if (recurrence === "ONE_TIME") return "NONE";
  return recurrence;
}
