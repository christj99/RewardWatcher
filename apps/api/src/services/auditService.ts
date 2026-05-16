import type {
  ConfidenceLevel,
  Lens,
  MerchantCategory,
  Prisma,
  Transaction,
  User,
} from "@prisma/client";
import {
  computeActualCardValueFromRecommendationResult,
  computeAuditOutcome,
  matchRecommendationToTransaction,
  recommendCardForPurchase,
  type AuditRecommendationCandidate,
  type AuditTransactionInput,
  type RecommendationResult,
} from "@rewards-audit/rewards-engine";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import { PrismaRewardsEngineRepository } from "../repositories/prismaRewardsEngineRepository.js";
import { findMerchantByTransactionName } from "./transactionMerchantService.js";

const auditOutcomeInclude = {
  transaction: {
    include: {
      merchant: true,
      userCard: {
        include: {
          card: {
            include: { issuer: true },
          },
        },
      },
    },
  },
  recommendationEvent: {
    include: {
      merchant: true,
      recommendedCard: {
        include: { issuer: true },
      },
    },
  },
  actualUserCard: {
    include: {
      card: {
        include: { issuer: true },
      },
    },
  },
  bestUserCard: {
    include: {
      card: {
        include: { issuer: true },
      },
    },
  },
  recommendedUserCard: {
    include: {
      card: {
        include: { issuer: true },
      },
    },
  },
} satisfies Prisma.RecommendationOutcomeInclude;

export async function auditTransaction(user: User, transactionId: string) {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      userId: user.id,
    },
    include: {
      merchant: true,
      userCard: true,
    },
  });

  if (!transaction) {
    throw notFound("Transaction was not found for the current user.");
  }

  let merchant = transaction.merchant;
  if (!merchant) {
    merchant = await findMerchantByTransactionName(
      transaction.normalizedMerchantName ?? transaction.rawMerchantName,
    );
  }

  const actualCategory = await determineActualCategory(
    transaction,
    merchant?.id,
  );
  const candidates = await loadRecommendationCandidates(user.id, transaction);
  const match = matchRecommendationToTransaction(
    toAuditTransaction(transaction, merchant?.id),
    candidates,
  );
  const matchedRecommendation = match.recommendationEventId
    ? candidates.find(
        (candidate) => candidate.id === match.recommendationEventId,
      )
    : null;
  const matchedRecommendationOrNull = matchedRecommendation ?? null;
  const lens: Lens = matchedRecommendationOrNull?.lens ?? "PRACTICAL";
  const repository = new PrismaRewardsEngineRepository();

  let bestRecommendationResult: RecommendationResult | null;
  try {
    bestRecommendationResult = await recommendCardForPurchase(
      {
        userId: user.id,
        merchantId: merchant?.id,
        merchantName: merchant ? undefined : transaction.rawMerchantName,
        purchaseAmountCents: transaction.amountCents,
        timestamp: transaction.transactionDate,
        lens,
        context: "IMPORTED_TRANSACTION_REPLAY",
        categoryOverride:
          actualCategory === "UNKNOWN" ? undefined : actualCategory,
        categoryOverrideReason:
          actualCategory === "UNKNOWN"
            ? undefined
            : `Audit replay used posted category ${actualCategory}.`,
        ignoreUserPreferences: true,
      },
      repository,
    );
  } catch {
    bestRecommendationResult = null;
  }

  const actualCardValue = bestRecommendationResult
    ? computeActualCardValueFromRecommendationResult(
        bestRecommendationResult,
        transaction.userCardId,
      )
    : null;
  const hasUserOverride = await hasApplicableUserOverride(
    user.id,
    transaction,
    merchant?.id,
    actualCategory,
  );
  const outcomeResult = computeAuditOutcome({
    transaction: {
      ...toAuditTransaction(transaction, merchant?.id),
      observedCategory: actualCategory,
    },
    matchedRecommendation: matchedRecommendationOrNull,
    bestRecommendationResult,
    actualCardValue,
    match,
    hasUserOverride,
  });

  return upsertOutcome(user.id, outcomeResult);
}

export async function listOutcomes(
  user: User,
  input: {
    limit: number;
    outcomeType?: Prisma.RecommendationOutcomeWhereInput["outcomeType"];
    transactionId?: string | undefined;
  },
) {
  return prisma.recommendationOutcome.findMany({
    where: {
      userId: user.id,
      ...(input.outcomeType ? { outcomeType: input.outcomeType } : {}),
      ...(input.transactionId ? { transactionId: input.transactionId } : {}),
    },
    include: auditOutcomeInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

export async function getOutcome(user: User, id: string) {
  const outcome = await prisma.recommendationOutcome.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: auditOutcomeInclude,
  });

  if (!outcome) {
    throw notFound("Outcome was not found for the current user.");
  }

  return outcome;
}

async function determineActualCategory(
  transaction: Pick<Transaction, "observedCategory" | "merchantId">,
  merchantId?: string | null,
): Promise<MerchantCategory> {
  if (transaction.observedCategory) {
    return transaction.observedCategory;
  }

  const resolvedMerchantId = merchantId ?? transaction.merchantId;
  if (!resolvedMerchantId) {
    return "UNKNOWN";
  }

  const profile = await prisma.merchantPostingProfile.findFirst({
    where: {
      merchantId: resolvedMerchantId,
      confidence: { not: "UNKNOWN" },
    },
    orderBy: [
      { confidence: "asc" },
      { observationCount: "desc" },
      { id: "asc" },
    ],
  });

  if (profile) {
    return profile.observedCategory;
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: resolvedMerchantId },
  });

  return merchant?.category ?? "UNKNOWN";
}

async function loadRecommendationCandidates(
  userId: string,
  transaction: Transaction,
): Promise<AuditRecommendationCandidate[]> {
  const transactionDate = transaction.transactionDate;
  const start = new Date(transactionDate);
  start.setDate(start.getDate() - 7);

  const events = await prisma.recommendationEvent.findMany({
    where: {
      userId,
      createdAt: {
        gte: start,
        lte: transactionDate,
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  return events.map((event) => ({
    id: event.id,
    userId: event.userId,
    merchantId: event.merchantId,
    merchantNameInput: event.merchantNameInput,
    merchantUrlInput: event.merchantUrlInput,
    purchaseAmountCents: event.purchaseAmountCents,
    context: event.context,
    lens: event.lens,
    recommendedUserCardId: event.recommendedUserCardId,
    recommendedCardId: event.recommendedCardId,
    expectedCategory: event.expectedCategory,
    expectedValueCents: event.expectedValueCents.toString(),
    confidence: event.confidence,
    explanation: event.explanation,
    createdAt: event.createdAt,
    inputSnapshot: event.inputSnapshot,
    rankingSnapshot: event.rankingSnapshot,
    ruleSnapshot: event.ruleSnapshot,
  }));
}

function toAuditTransaction(
  transaction: Transaction,
  merchantId?: string | null,
): AuditTransactionInput {
  return {
    id: transaction.id,
    userId: transaction.userId,
    userCardId: transaction.userCardId,
    merchantId: merchantId ?? transaction.merchantId,
    rawMerchantName: transaction.rawMerchantName,
    normalizedMerchantName: transaction.normalizedMerchantName,
    amountCents: transaction.amountCents,
    currencyCode: transaction.currencyCode,
    transactionDate: transaction.transactionDate,
    postedDate: transaction.postedDate,
    observedCategory: transaction.observedCategory,
    observedMcc: transaction.observedMcc,
    source: transaction.source,
  };
}

async function hasApplicableUserOverride(
  userId: string,
  transaction: Transaction,
  merchantId: string | null | undefined,
  category: MerchantCategory,
): Promise<boolean> {
  const userCard = transaction.userCardId
    ? await prisma.userCard.findUnique({
        where: { id: transaction.userCardId },
      })
    : null;

  const rule = await prisma.userPreferenceRule.findFirst({
    where: {
      userId,
      preferenceType: { in: ["PREFER_CARD", "AVOID_CARD", "CUSTOM_NOTE"] },
      AND: [
        { OR: [{ merchantId: null }, ...(merchantId ? [{ merchantId }] : [])] },
        { OR: [{ category: null }, { category }] },
        {
          OR: [
            { cardId: null },
            ...(userCard?.cardId ? [{ cardId: userCard.cardId }] : []),
          ],
        },
      ],
    },
  });

  return Boolean(rule);
}

async function upsertOutcome(
  userId: string,
  outcome: ReturnType<typeof computeAuditOutcome>,
) {
  const existing = await prisma.recommendationOutcome.findFirst({
    where: {
      transactionId: outcome.transactionId,
      recommendationEventId: outcome.recommendationEventId ?? null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const data = {
    userId,
    recommendationEventId: outcome.recommendationEventId ?? null,
    transactionId: outcome.transactionId,
    outcomeType: outcome.outcomeType,
    actualUserCardId: outcome.actualUserCardId ?? null,
    bestUserCardId: outcome.bestUserCardId ?? null,
    recommendedUserCardId: outcome.recommendedUserCardId ?? null,
    expectedValueCents: decimalString(outcome.expectedValueCents),
    capturedValueCents: decimalString(outcome.capturedValueCents),
    missedValueCents: decimalString(outcome.missedValueCents),
    recommendationWasCorrect: outcome.recommendationWasCorrect ?? null,
    confidence: outcome.confidence as ConfidenceLevel,
    explanation: outcome.explanation,
    computedAt: new Date(),
  };

  if (existing) {
    return prisma.recommendationOutcome.update({
      where: { id: existing.id },
      data,
      include: auditOutcomeInclude,
    });
  }

  return prisma.recommendationOutcome.create({
    data,
    include: auditOutcomeInclude,
  });
}

function decimalString(value: number | undefined): string | null {
  return value === undefined ? null : value.toFixed(4);
}
