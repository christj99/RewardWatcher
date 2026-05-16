import {
  CorrectionStatus,
  type CorrectionType,
  type Priority,
  type Prisma,
  type ReviewTaskStatus,
  type ReviewTaskType,
} from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";

export function reviewTaskPlanForCorrection(
  correctionType: CorrectionType,
): Pick<
  Prisma.CuratorReviewTaskUncheckedCreateInput,
  "taskType" | "priority"
> | null {
  switch (correctionType) {
    case "WRONG_MERCHANT":
      return { taskType: "MERCHANT_MAPPING_REVIEW", priority: "MEDIUM" };
    case "WRONG_CATEGORY":
      return { taskType: "POSTING_PROFILE_REVIEW", priority: "MEDIUM" };
    case "WRONG_CARD_RULE":
      return { taskType: "CARD_RULE_REVIEW", priority: "HIGH" };
    case "MISSED_OFFER":
      return { taskType: "OFFER_REVIEW", priority: "MEDIUM" };
    case "CAP_NOT_HANDLED":
      return { taskType: "CARD_RULE_REVIEW", priority: "HIGH" };
    case "OTHER":
      return { taskType: "OTHER", priority: "LOW" };
    case "PERSONAL_PREFERENCE":
      return null;
  }
}

export async function listAdminReviewTasks(input: {
  status?: ReviewTaskStatus | undefined;
  taskType?: ReviewTaskType | undefined;
  priority?: Priority | undefined;
  correctionId?: string | undefined;
  limit: number;
}) {
  const where: Prisma.CuratorReviewTaskWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.taskType ? { taskType: input.taskType } : {}),
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.correctionId ? { correctionId: input.correctionId } : {}),
  };

  return prisma.curatorReviewTask.findMany({
    where,
    include: {
      correction: {
        include: {
          user: {
            select: { id: true, email: true, displayName: true },
          },
          recommendationEvent: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

export async function getAdminReviewTask(id: string) {
  const task = await prisma.curatorReviewTask.findUnique({
    where: { id },
    include: {
      correction: {
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
              recommendedUserCard: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    throw notFound("Review task was not found.");
  }

  return task;
}

export async function updateAdminReviewTask(
  id: string,
  input: {
    status?: ReviewTaskStatus | undefined;
    priority?: Priority | undefined;
    resolutionNotes?: string | null | undefined;
  },
) {
  const existing = await prisma.curatorReviewTask.findUnique({
    where: { id },
  });

  if (!existing) {
    throw notFound("Review task was not found.");
  }

  const updated = await prisma.curatorReviewTask.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.resolutionNotes !== undefined
        ? { resolutionNotes: input.resolutionNotes }
        : {}),
    },
    include: {
      correction: true,
    },
  });

  if (updated.correctionId && input.status) {
    await updateLinkedCorrectionForReviewTask(
      updated.correctionId,
      input.status,
    );
  }

  return getAdminReviewTask(id);
}

async function updateLinkedCorrectionForReviewTask(
  correctionId: string,
  status: ReviewTaskStatus,
) {
  if (status === "IN_PROGRESS") {
    await prisma.recommendationCorrection.updateMany({
      where: { id: correctionId, status: CorrectionStatus.OPEN },
      data: { status: CorrectionStatus.IN_REVIEW },
    });
    return;
  }

  if (status === "RESOLVED") {
    await prisma.recommendationCorrection.updateMany({
      where: {
        id: correctionId,
        status: { in: [CorrectionStatus.OPEN, CorrectionStatus.IN_REVIEW] },
      },
      data: { status: CorrectionStatus.RESOLVED },
    });
    return;
  }

  if (status === "REJECTED") {
    await prisma.recommendationCorrection.updateMany({
      where: {
        id: correctionId,
        status: { in: [CorrectionStatus.OPEN, CorrectionStatus.IN_REVIEW] },
      },
      data: { status: CorrectionStatus.REJECTED },
    });
  }
}

export function reviewTaskTitle(
  correctionType: CorrectionType,
  recommendationId: string,
  merchantLabel: string,
): string {
  switch (correctionType) {
    case "WRONG_MERCHANT":
      return `Review merchant mapping for recommendation ${recommendationId}`;
    case "WRONG_CATEGORY":
      return `Review posting category for ${merchantLabel}`;
    case "WRONG_CARD_RULE":
      return `Review card rule used in recommendation ${recommendationId}`;
    case "MISSED_OFFER":
      return `Review missed offer report for recommendation ${recommendationId}`;
    case "CAP_NOT_HANDLED":
      return `Review cap handling for recommendation ${recommendationId}`;
    case "OTHER":
      return `Review correction for recommendation ${recommendationId}`;
    case "PERSONAL_PREFERENCE":
      return `Review personal preference for recommendation ${recommendationId}`;
  }
}
