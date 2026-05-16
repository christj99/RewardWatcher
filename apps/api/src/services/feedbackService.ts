import type {
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackType,
  Prisma,
  User,
} from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import { redactSensitive } from "../lib/redaction.js";
import { recordAdminAuditLog } from "./adminAuditLogService.js";
import { recordBetaEvent } from "./betaEventService.js";

const feedbackInclude = {
  user: { select: { id: true, email: true, displayName: true } },
  linkedRecommendationEvent: {
    select: {
      id: true,
      merchantNameInput: true,
      merchantUrlInput: true,
      confidence: true,
      createdAt: true,
    },
  },
  linkedTransaction: {
    select: {
      id: true,
      rawMerchantName: true,
      amountCents: true,
      transactionDate: true,
    },
  },
  linkedOutcome: {
    select: {
      id: true,
      outcomeType: true,
      missedValueCents: true,
      confidence: true,
      createdAt: true,
    },
  },
  assignedAdminUser: {
    select: { id: true, email: true, displayName: true },
  },
} satisfies Prisma.FeedbackReportInclude;

export async function createFeedbackReport(
  user: User,
  input: {
    feedbackType: FeedbackType;
    severity: FeedbackSeverity;
    title: string;
    message: string;
    pageUrl?: string | undefined;
    context?: Record<string, unknown> | undefined;
    linkedRecommendationEventId?: string | undefined;
    linkedTransactionId?: string | undefined;
    linkedOutcomeId?: string | undefined;
  },
  request?: FastifyRequest,
) {
  await validateUserLinks(user.id, input);
  const data: Prisma.FeedbackReportUncheckedCreateInput = {
    userId: user.id,
    feedbackType: input.feedbackType,
    severity: input.severity,
    title: input.title,
    message: input.message,
    pageUrl: input.pageUrl ?? null,
    userAgent: request?.headers["user-agent"]?.toString() ?? null,
    linkedRecommendationEventId: input.linkedRecommendationEventId ?? null,
    linkedTransactionId: input.linkedTransactionId ?? null,
    linkedOutcomeId: input.linkedOutcomeId ?? null,
  };
  if (input.context !== undefined) {
    data.context = redactSensitive(input.context) as Prisma.InputJsonValue;
  }
  const report = await prisma.feedbackReport.create({
    data,
    include: feedbackInclude,
  });
  await recordBetaEvent({
    userId: user.id,
    eventType: "FEEDBACK_SUBMITTED",
    source: "API",
    metadata: {
      feedbackId: report.id,
      feedbackType: report.feedbackType,
      severity: report.severity,
      pageUrl: report.pageUrl,
    },
  });
  return report;
}

export async function listUserFeedback(
  user: User,
  input: {
    status?: FeedbackStatus | undefined;
    feedbackType?: FeedbackType | undefined;
    severity?: FeedbackSeverity | undefined;
    limit: number;
  },
) {
  return prisma.feedbackReport.findMany({
    where: {
      userId: user.id,
      ...(input.status ? { status: input.status } : {}),
      ...(input.feedbackType ? { feedbackType: input.feedbackType } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
    },
    include: feedbackInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

export async function getUserFeedback(user: User, id: string) {
  const report = await prisma.feedbackReport.findFirst({
    where: { id, userId: user.id },
    include: feedbackInclude,
  });
  if (!report) throw notFound("Feedback report was not found.");
  return report;
}

export async function listAdminFeedback(input: {
  status?: FeedbackStatus | undefined;
  feedbackType?: FeedbackType | undefined;
  severity?: FeedbackSeverity | undefined;
  userId?: string | undefined;
  assignedAdminUserId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  limit: number;
}) {
  return prisma.feedbackReport.findMany({
    where: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.feedbackType ? { feedbackType: input.feedbackType } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.assignedAdminUserId
        ? { assignedAdminUserId: input.assignedAdminUserId }
        : {}),
      ...(input.startDate || input.endDate
        ? {
            createdAt: {
              ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
              ...(input.endDate ? { lt: new Date(input.endDate) } : {}),
            },
          }
        : {}),
    },
    include: feedbackInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

export async function getAdminFeedback(id: string) {
  const report = await prisma.feedbackReport.findUnique({
    where: { id },
    include: feedbackInclude,
  });
  if (!report) throw notFound("Feedback report was not found.");
  return report;
}

export async function updateAdminFeedback(
  admin: User,
  id: string,
  input: {
    status?: FeedbackStatus | undefined;
    severity?: FeedbackSeverity | undefined;
    assignedAdminUserId?: string | null | undefined;
    resolutionNotes?: string | null | undefined;
  },
  request?: FastifyRequest,
) {
  const before = await getAdminFeedback(id);
  const status = input.status ?? before.status;
  const after = await prisma.feedbackReport.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.assignedAdminUserId !== undefined
        ? { assignedAdminUserId: input.assignedAdminUserId }
        : {}),
      ...(input.resolutionNotes !== undefined
        ? { resolutionNotes: input.resolutionNotes }
        : {}),
      ...(status === "RESOLVED" || status === "REJECTED"
        ? { resolvedAt: new Date() }
        : status === "OPEN" || status === "TRIAGED" || status === "IN_PROGRESS"
          ? { resolvedAt: null }
          : {}),
    },
    include: feedbackInclude,
  });
  await recordAdminAuditLog({
    adminUserId: admin.id,
    action:
      after.status === "RESOLVED"
        ? "RESOLVE"
        : after.status === "REJECTED"
          ? "REJECT"
          : "UPDATE",
    entityType: "FeedbackReport",
    entityId: id,
    before,
    after,
    request,
  });
  return after;
}

async function validateUserLinks(
  userId: string,
  input: {
    linkedRecommendationEventId?: string | undefined;
    linkedTransactionId?: string | undefined;
    linkedOutcomeId?: string | undefined;
  },
) {
  const [recommendation, transaction, outcome] = await Promise.all([
    input.linkedRecommendationEventId
      ? prisma.recommendationEvent.findFirst({
          where: { id: input.linkedRecommendationEventId, userId },
        })
      : Promise.resolve(null),
    input.linkedTransactionId
      ? prisma.transaction.findFirst({
          where: { id: input.linkedTransactionId, userId },
        })
      : Promise.resolve(null),
    input.linkedOutcomeId
      ? prisma.recommendationOutcome.findFirst({
          where: { id: input.linkedOutcomeId, userId },
        })
      : Promise.resolve(null),
  ]);

  if (input.linkedRecommendationEventId && !recommendation) {
    throw notFound("Linked recommendation was not found for the current user.");
  }
  if (input.linkedTransactionId && !transaction) {
    throw notFound("Linked transaction was not found for the current user.");
  }
  if (input.linkedOutcomeId && !outcome) {
    throw notFound("Linked outcome was not found for the current user.");
  }
}
