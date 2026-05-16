import {
  CorrectionStatus,
  type MerchantCategory,
  type PreferenceType,
  type Prisma,
  type User,
  type CorrectionType,
} from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import type { CreateCorrectionInput } from "../schemas/corrections.js";
import {
  reviewTaskPlanForCorrection,
  reviewTaskTitle,
} from "./reviewTaskService.js";
import { createPersonalPreferenceRuleIfUseful } from "./userPreferenceService.js";

type SuggestedRecords = {
  merchant: Awaited<ReturnType<typeof prisma.merchant.findUnique>> | null;
  card: Awaited<ReturnType<typeof prisma.card.findUnique>> | null;
};

export async function validateCorrectionSuggestions(
  input: Pick<CreateCorrectionInput, "suggestedMerchantId" | "suggestedCardId">,
): Promise<SuggestedRecords> {
  const [merchant, card] = await Promise.all([
    input.suggestedMerchantId
      ? prisma.merchant.findUnique({ where: { id: input.suggestedMerchantId } })
      : Promise.resolve(null),
    input.suggestedCardId
      ? prisma.card.findUnique({ where: { id: input.suggestedCardId } })
      : Promise.resolve(null),
  ]);

  if (input.suggestedMerchantId && !merchant) {
    throw notFound("Suggested merchant was not found.");
  }

  if (input.suggestedCardId && !card) {
    throw notFound("Suggested card was not found.");
  }

  return { merchant, card };
}

export async function createRecommendationCorrection(
  user: User,
  recommendationId: string,
  input: CreateCorrectionInput,
) {
  const recommendation = await prisma.recommendationEvent.findFirst({
    where: {
      id: recommendationId,
      userId: user.id,
    },
    include: {
      merchant: true,
      recommendedCard: true,
    },
  });

  if (!recommendation) {
    throw notFound("Recommendation was not found for the current user.");
  }

  const { merchant: suggestedMerchant, card: suggestedCard } =
    await validateCorrectionSuggestions(input);

  const correction = await prisma.recommendationCorrection.create({
    data: {
      userId: user.id,
      recommendationEventId: recommendation.id,
      correctionType: input.correctionType,
      userNote: input.userNote ?? null,
      status: CorrectionStatus.OPEN,
    },
  });

  const reviewTaskPlan = reviewTaskPlanForCorrection(input.correctionType);
  const reviewTask = reviewTaskPlan
    ? await prisma.curatorReviewTask.create({
        data: {
          correctionId: correction.id,
          ...reviewTaskPlan,
          title: reviewTaskTitle(
            input.correctionType,
            recommendation.id,
            merchantLabelForRecommendation(recommendation),
          ),
          description: buildReviewTaskDescription({
            recommendation,
            correctionType: input.correctionType,
            userNote: input.userNote,
            suggestedMerchantName: suggestedMerchant?.name,
            suggestedCategory: input.suggestedCategory,
            suggestedCardName: suggestedCard?.name,
          }),
        },
      })
    : null;

  let preferenceResult: Awaited<
    ReturnType<typeof createPersonalPreferenceRuleIfUseful>
  > | null = null;

  if (
    input.correctionType === "PERSONAL_PREFERENCE" &&
    input.preferenceAction
  ) {
    preferenceResult = await createPersonalPreferenceRuleIfUseful(
      user,
      recommendation,
      {
        preferenceType: input.preferenceAction as PreferenceType,
        reason: input.userNote,
        suggestedCard,
        suggestedMerchantId:
          input.suggestedMerchantId ?? recommendation.merchantId ?? undefined,
        suggestedCategory:
          (input.suggestedCategory as MerchantCategory | undefined) ??
          recommendation.expectedCategory,
      },
    );
  }

  return {
    correction,
    reviewTask,
    userPreferenceRule: preferenceResult?.userPreferenceRule ?? null,
    message:
      preferenceResult?.message ??
      (reviewTask
        ? "Correction saved and curator review task created."
        : "Correction saved."),
  };
}

export async function listUserCorrections(
  user: User,
  input: {
    status?: CorrectionStatus | undefined;
    correctionType?: CorrectionType | undefined;
    limit: number;
  },
) {
  const where: Prisma.RecommendationCorrectionWhereInput = {
    userId: user.id,
    ...(input.status ? { status: input.status } : {}),
    ...(input.correctionType ? { correctionType: input.correctionType } : {}),
  };

  return prisma.recommendationCorrection.findMany({
    where,
    include: {
      recommendationEvent: {
        include: {
          merchant: true,
          recommendedCard: {
            include: { issuer: true },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

export async function getUserCorrection(user: User, id: string) {
  const correction = await prisma.recommendationCorrection.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      recommendationEvent: {
        include: {
          merchant: true,
          recommendedCard: {
            include: { issuer: true },
          },
        },
      },
      reviewTasks: {
        select: {
          id: true,
          status: true,
          priority: true,
          taskType: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!correction) {
    throw notFound("Correction was not found for the current user.");
  }

  return correction;
}

export async function listAdminCorrections(input: {
  status?: CorrectionStatus | undefined;
  correctionType?: CorrectionType | undefined;
  userId?: string | undefined;
  recommendationEventId?: string | undefined;
  limit: number;
}) {
  const where: Prisma.RecommendationCorrectionWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.correctionType ? { correctionType: input.correctionType } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.recommendationEventId
      ? { recommendationEventId: input.recommendationEventId }
      : {}),
  };

  return prisma.recommendationCorrection.findMany({
    where,
    include: {
      user: {
        select: { id: true, email: true, displayName: true },
      },
      recommendationEvent: {
        include: {
          merchant: true,
          recommendedCard: {
            include: { issuer: true },
          },
        },
      },
      reviewTasks: {
        select: {
          id: true,
          taskType: true,
          status: true,
          priority: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

export async function updateAdminCorrection(
  id: string,
  input: {
    status?: CorrectionStatus | undefined;
    resolutionNotes?: string | null | undefined;
  },
) {
  const existing = await prisma.recommendationCorrection.findUnique({
    where: { id },
  });

  if (!existing) {
    throw notFound("Correction was not found.");
  }

  await prisma.recommendationCorrection.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.resolutionNotes !== undefined
        ? { resolutionNotes: input.resolutionNotes }
        : {}),
    },
  });

  if (input.status === "IN_REVIEW") {
    await prisma.curatorReviewTask.updateMany({
      where: { correctionId: id, status: "OPEN" },
      data: { status: "IN_PROGRESS" },
    });
  }

  if (input.status === "RESOLVED") {
    await prisma.curatorReviewTask.updateMany({
      where: { correctionId: id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { status: "RESOLVED" },
    });
  }

  const updated = await prisma.recommendationCorrection.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, displayName: true },
      },
      recommendationEvent: {
        include: {
          merchant: true,
          recommendedCard: {
            include: { issuer: true },
          },
        },
      },
      reviewTasks: true,
    },
  });

  return updated;
}

function merchantLabelForRecommendation(
  recommendation: Prisma.RecommendationEventGetPayload<{
    include: { merchant: true; recommendedCard: true };
  }>,
): string {
  return (
    recommendation.merchant?.name ??
    recommendation.merchantNameInput ??
    "unresolved merchant"
  );
}

function buildReviewTaskDescription(input: {
  recommendation: Prisma.RecommendationEventGetPayload<{
    include: { merchant: true; recommendedCard: true };
  }>;
  correctionType: CorrectionType;
  userNote?: string | undefined;
  suggestedMerchantName?: string | undefined;
  suggestedCategory?: MerchantCategory | undefined;
  suggestedCardName?: string | undefined;
}): string {
  const lines = [
    `Recommendation id: ${input.recommendation.id}`,
    `User id: ${input.recommendation.userId}`,
    `Correction type: ${input.correctionType}`,
    `Merchant input: ${
      input.recommendation.merchantNameInput ??
      input.recommendation.merchant?.name ??
      "not provided"
    }`,
    `Resolved merchant: ${input.recommendation.merchant?.name ?? "none"}`,
    `Expected category: ${input.recommendation.expectedCategory}`,
    `Recommended card: ${input.recommendation.recommendedCard.name}`,
  ];

  if (input.userNote) {
    lines.push(`User note: ${input.userNote}`);
  }

  if (input.suggestedMerchantName) {
    lines.push(`Suggested merchant: ${input.suggestedMerchantName}`);
  }

  if (input.suggestedCategory) {
    lines.push(`Suggested category: ${input.suggestedCategory}`);
  }

  if (input.suggestedCardName) {
    lines.push(`Suggested card: ${input.suggestedCardName}`);
  }

  return lines.join("\n");
}
