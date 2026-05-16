import {
  BetaEventType,
  type BetaEventSource,
  type Prisma,
} from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { redactSensitive } from "../lib/redaction.js";

export async function recordBetaEvent(input: {
  userId?: string | null;
  eventType: BetaEventType;
  source: BetaEventSource;
  metadata?: unknown;
}): Promise<void> {
  try {
    const data: Prisma.BetaEventUncheckedCreateInput = {
      userId: input.userId ?? null,
      eventType: input.eventType,
      source: input.source,
    };
    if (input.metadata !== undefined) {
      data.metadata = redactSensitive(input.metadata) as Prisma.InputJsonValue;
    }
    await prisma.betaEvent.create({ data });
    if (
      input.userId &&
      input.eventType !== BetaEventType.PRIVACY_DELETION_REQUESTED
    ) {
      await updateMilestone(input.userId, input.eventType);
    }
  } catch {
    // Beta events are diagnostic breadcrumbs. They must never break the primary flow.
  }
}

async function updateMilestone(userId: string, eventType: BetaEventType) {
  const now = new Date();
  const existing = await prisma.userBetaProfile.findUnique({
    where: { userId },
  });
  const create = {
    userId,
    status: "ACTIVE" as const,
    activatedAt: now,
    invitedAt: now,
    ...milestoneData(eventType, now),
  };
  if (!existing) {
    await prisma.userBetaProfile.create({ data: create });
    return;
  }

  await prisma.userBetaProfile.update({
    where: { userId },
    data: {
      ...(existing.status === "INVITED" ? { status: "ACTIVE" as const } : {}),
      ...(existing.activatedAt ? {} : { activatedAt: now }),
      ...milestoneData(eventType, now, existing),
    },
  });
}

function milestoneData(
  eventType: BetaEventType,
  now: Date,
  existing?: {
    firstRecommendationAt: Date | null;
    firstTransactionAuditAt: Date | null;
    firstPlaidSyncAt: Date | null;
  },
) {
  if (
    eventType === "RECOMMENDATION_CREATED" &&
    !existing?.firstRecommendationAt
  ) {
    return { firstRecommendationAt: now };
  }
  if (
    eventType === "TRANSACTION_AUDITED" &&
    !existing?.firstTransactionAuditAt
  ) {
    return { firstTransactionAuditAt: now };
  }
  if (eventType === "PLAID_SYNC_COMPLETED" && !existing?.firstPlaidSyncAt) {
    return { firstPlaidSyncAt: now };
  }
  return {};
}
