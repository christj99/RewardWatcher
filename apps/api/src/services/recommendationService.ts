import type { Prisma, User } from "@prisma/client";
import {
  InvalidPurchaseAmountError,
  MerchantNotFoundError,
  NoEligibleEarningRulesError,
  recommendCardForPurchase,
  UserHasNoActiveCardsError,
  type RecommendationInput,
} from "@rewards-audit/rewards-engine";

import { prisma } from "@rewards-audit/db";

import { unprocessable, notFound, badRequest } from "../lib/httpErrors.js";
import { PrismaRewardsEngineRepository } from "../repositories/prismaRewardsEngineRepository.js";

type RecommendationRequest = Omit<RecommendationInput, "userId" | "timestamp">;

export async function createRecommendation(
  user: User,
  input: RecommendationRequest,
) {
  const repository = new PrismaRewardsEngineRepository();

  try {
    const result = await recommendCardForPurchase(
      {
        userId: user.id,
        merchantId: input.merchantId,
        merchantUrl: input.merchantUrl,
        merchantName: input.merchantName,
        purchaseAmountCents: input.purchaseAmountCents,
        lens: input.lens,
        context: input.context,
      },
      repository,
    );

    const data: Prisma.RecommendationEventUncheckedCreateInput = {
      userId: user.id,
      merchantId: result.resolvedMerchant.id ?? null,
      merchantNameInput:
        input.merchantName ?? result.resolvedMerchant.name ?? null,
      merchantUrlInput: input.merchantUrl ?? null,
      purchaseAmountCents: result.input.purchaseAmountCents,
      context: result.input.context,
      lens: result.input.lens,
      recommendedUserCardId: result.primaryRecommendation.userCardId,
      recommendedCardId: result.primaryRecommendation.cardId,
      expectedCategory: result.expectedCategory,
      expectedValueCents: result.primaryRecommendation.expectedValueCents,
      confidence: result.confidence,
      explanation: result.explanation,
      inputSnapshot: result.inputSnapshot as Prisma.InputJsonValue,
      rankingSnapshot: result.rankingSnapshot as Prisma.InputJsonValue,
      ruleSnapshot: result.ruleSnapshot as Prisma.InputJsonValue,
    };
    const event = await prisma.recommendationEvent.create({
      data: {
        ...data,
      },
      include: {
        merchant: true,
      },
    });

    return {
      id: event.id,
      createdAt: event.createdAt,
      merchant: event.merchant,
      purchaseAmountCents: event.purchaseAmountCents,
      context: event.context,
      lens: event.lens,
      expectedCategory: event.expectedCategory,
      confidence: event.confidence,
      explanation: event.explanation,
      primaryRecommendation: result.primaryRecommendation,
      alternatives: result.alternatives,
      warnings: result.warnings,
      inputSnapshot: result.inputSnapshot,
      rankingSnapshot: result.rankingSnapshot,
      ruleSnapshot: result.ruleSnapshot,
    };
  } catch (error) {
    if (error instanceof InvalidPurchaseAmountError) {
      throw badRequest(error.message);
    }

    if (error instanceof MerchantNotFoundError) {
      throw notFound(error.message);
    }

    if (
      error instanceof UserHasNoActiveCardsError ||
      error instanceof NoEligibleEarningRulesError
    ) {
      throw unprocessable(error.message);
    }

    throw error;
  }
}

export async function listRecommendationHistory(
  user: User,
  input: { limit: number; merchantId?: string | undefined },
) {
  const where: Prisma.RecommendationEventWhereInput = {
    userId: user.id,
    ...(input.merchantId ? { merchantId: input.merchantId } : {}),
  };

  return prisma.recommendationEvent.findMany({
    where,
    include: {
      merchant: true,
      recommendedCard: {
        include: { issuer: true },
      },
      recommendedUserCard: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

export async function getRecommendationReceipt(user: User, id: string) {
  const event = await prisma.recommendationEvent.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      merchant: true,
      recommendedCard: {
        include: { issuer: true },
      },
      recommendedUserCard: true,
      outcomes: true,
      corrections: {
        select: {
          id: true,
          correctionType: true,
          status: true,
          userNote: true,
          resolutionNotes: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!event) {
    throw notFound("Recommendation was not found for the current user.");
  }

  return event;
}
