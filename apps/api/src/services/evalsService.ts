import type { Prisma } from "@prisma/client";
import {
  calculateKillTestReport,
  type KillTestCorrectionDto,
  type KillTestOutcomeDto,
  type KillTestTransactionDto,
} from "@rewards-audit/rewards-engine";

import { prisma } from "@rewards-audit/db";

const outcomeInclude = {
  user: {
    select: { id: true, email: true },
  },
  transaction: {
    include: {
      merchant: true,
    },
  },
  recommendationEvent: true,
} satisfies Prisma.RecommendationOutcomeInclude;

type EvalOutcome = Prisma.RecommendationOutcomeGetPayload<{
  include: typeof outcomeInclude;
}>;

export async function getKillTestEvaluation(input: {
  startDate?: string | undefined;
  endDate?: string | undefined;
  meaningfulMissThresholdCents: number;
  annualSubscriptionPriceCents: number;
  primaryKillTestUserShare: number;
  maxRecommendationErrorRate: number;
  maxInconclusiveRate: number;
}) {
  const { startDate, endDate } = resolveRange(input.startDate, input.endDate);
  const [outcomes, transactions] = await Promise.all([
    prisma.recommendationOutcome.findMany({
      where: {
        transaction: {
          transactionDate: {
            gte: startDate,
            lt: endDate,
          },
        },
      },
      include: outcomeInclude,
      orderBy: [{ computedAt: "desc" }, { id: "asc" }],
    }),
    prisma.transaction.findMany({
      where: {
        transactionDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
      orderBy: [{ transactionDate: "desc" }, { id: "asc" }],
    }),
  ]);
  const evaluatedUserIds = new Set<string>([
    ...outcomes.map((outcome) => outcome.userId),
    ...transactions.map((transaction) => transaction.userId),
  ]);
  const corrections =
    evaluatedUserIds.size === 0
      ? []
      : await prisma.recommendationCorrection.findMany({
          where: {
            userId: { in: [...evaluatedUserIds] },
            createdAt: {
              gte: startDate,
              lt: endDate,
            },
          },
          select: {
            id: true,
            userId: true,
            createdAt: true,
          },
        });
  const report = calculateKillTestReport({
    startDate,
    endDate,
    meaningfulMissThresholdCents: input.meaningfulMissThresholdCents,
    annualSubscriptionPriceCents: input.annualSubscriptionPriceCents,
    primaryKillTestUserShare: input.primaryKillTestUserShare,
    maxRecommendationErrorRate: input.maxRecommendationErrorRate,
    maxInconclusiveRate: input.maxInconclusiveRate,
    outcomes: outcomes.map(mapOutcome),
    transactions: transactions.map(mapTransaction),
    corrections: corrections.map(mapCorrection),
  });

  return {
    ...report,
    generatedAt: new Date().toISOString(),
  };
}

function resolveRange(
  startDateInput?: string,
  endDateInput?: string,
): { startDate: Date; endDate: Date } {
  if (startDateInput && endDateInput) {
    return {
      startDate: new Date(startDateInput),
      endDate: new Date(endDateInput),
    };
  }

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 30);

  return { startDate, endDate };
}

function mapOutcome(outcome: EvalOutcome): KillTestOutcomeDto {
  return {
    id: outcome.id,
    userId: outcome.userId,
    userEmail: outcome.user.email,
    outcomeType: outcome.outcomeType,
    capturedValueCents: decimalToNumber(outcome.capturedValueCents),
    missedValueCents: decimalToNumber(outcome.missedValueCents),
    recommendationEventId: outcome.recommendationEventId,
    confidence: outcome.confidence,
    computedAt: outcome.computedAt,
    createdAt: outcome.createdAt,
    transaction: {
      id: outcome.transaction.id,
      userId: outcome.transaction.userId,
      transactionDate: outcome.transaction.transactionDate,
      amountCents: outcome.transaction.amountCents,
      observedCategory: outcome.transaction.observedCategory,
      merchantName:
        outcome.transaction.merchant?.name ??
        outcome.transaction.normalizedMerchantName ??
        outcome.transaction.rawMerchantName,
    },
    recommendationEvent: outcome.recommendationEvent,
  };
}

function mapTransaction(
  transaction: Prisma.TransactionGetPayload<{
    include: { user: { select: { id: true; email: true } } };
  }>,
): KillTestTransactionDto {
  return {
    id: transaction.id,
    userId: transaction.userId,
    userEmail: transaction.user.email,
    transactionDate: transaction.transactionDate,
  };
}

function mapCorrection(input: {
  id: string;
  userId: string;
  createdAt: Date;
}): KillTestCorrectionDto {
  return {
    id: input.id,
    userId: input.userId,
    createdAt: input.createdAt,
  };
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value.toString());
}
