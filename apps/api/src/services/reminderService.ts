import type {
  Prisma,
  Recurrence,
  ReminderRecurrence,
  ReminderSource,
  ReminderStatus,
  ReminderType,
  User,
} from "@prisma/client";
import {
  computeAnnualFeeReminderDate,
  computeStatementCreditPeriod,
  computeStatementCreditReminderDate,
  computeWelcomeBonusReminderDate,
} from "@rewards-audit/rewards-engine";

import { prisma } from "@rewards-audit/db";

import { badRequest, notFound } from "../lib/httpErrors.js";

const reminderInclude = {
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
} satisfies Prisma.ReminderInclude;

export async function listReminders(
  user: User,
  input: {
    status?: ReminderStatus | undefined;
    reminderType?: ReminderType | undefined;
    dueBefore?: string | undefined;
    dueAfter?: string | undefined;
    includeDismissed: boolean;
    limit: number;
  },
) {
  const where: Prisma.ReminderWhereInput = {
    userId: user.id,
  };
  if (input.status) {
    where.status = input.status;
  } else if (!input.includeDismissed) {
    where.status = { not: "DISMISSED" };
  }
  if (input.reminderType) {
    where.reminderType = input.reminderType;
  }
  if (input.dueBefore || input.dueAfter) {
    where.dueAt = {
      ...(input.dueBefore ? { lt: new Date(input.dueBefore) } : {}),
      ...(input.dueAfter ? { gt: new Date(input.dueAfter) } : {}),
    };
  }

  return prisma.reminder.findMany({
    where,
    include: reminderInclude,
    orderBy: [
      { status: "asc" },
      { dueAt: "asc" },
      { createdAt: "desc" },
      { id: "asc" },
    ],
    take: input.limit,
  });
}

export async function createReminder(
  user: User,
  input: {
    userCardId?: string | undefined;
    statementCreditId?: string | undefined;
    reminderType: ReminderType;
    title: string;
    description?: string | null | undefined;
    dueAt: string;
    recurrence: ReminderRecurrence;
    source: ReminderSource;
  },
) {
  await validateReminderLinks(user, input.userCardId, input.statementCreditId);

  return prisma.reminder.create({
    data: buildReminderCreateData({
      userId: user.id,
      userCardId: input.userCardId,
      statementCreditId: input.statementCreditId,
      reminderType: input.reminderType,
      title: input.title,
      description: input.description,
      dueAt: new Date(input.dueAt),
      recurrence: input.recurrence,
      source: input.source,
    }),
    include: reminderInclude,
  });
}

export async function getReminder(user: User, reminderId: string) {
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, userId: user.id },
    include: reminderInclude,
  });
  if (!reminder) {
    throw notFound("Reminder not found.");
  }
  return reminder;
}

export async function updateReminder(
  user: User,
  reminderId: string,
  input: {
    title?: string | undefined;
    description?: string | null | undefined;
    dueAt?: string | undefined;
    status?: ReminderStatus | undefined;
    recurrence?: ReminderRecurrence | null | undefined;
  },
) {
  await getReminder(user, reminderId);
  const now = new Date();
  const data: Prisma.ReminderUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.dueAt !== undefined) data.dueAt = new Date(input.dueAt);
  if (input.status !== undefined) data.status = input.status;
  if (input.recurrence !== undefined) data.recurrence = input.recurrence;

  if (input.status === "COMPLETED") {
    data.completedAt = now;
    data.dismissedAt = null;
  } else if (input.status === "DISMISSED") {
    data.dismissedAt = now;
    data.completedAt = null;
  } else if (input.status === "SCHEDULED" || input.status === "DUE") {
    data.completedAt = null;
    data.dismissedAt = null;
  }

  return prisma.reminder.update({
    where: { id: reminderId },
    data,
    include: reminderInclude,
  });
}

export async function dismissReminder(user: User, reminderId: string) {
  return updateReminder(user, reminderId, { status: "DISMISSED" });
}

export async function generateDefaultReminders(
  user: User,
  input: { overwriteExisting: boolean },
) {
  const now = new Date();
  const wallet = await prisma.userCard.findMany({
    where: { userId: user.id, isActive: true },
    include: {
      card: {
        include: {
          issuer: true,
          statementCredits: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const reminders = [];

  for (const userCard of wallet) {
    if (userCard.annualFeeDueMonth) {
      const dueAt = computeAnnualFeeReminderDate(
        userCard.annualFeeDueMonth,
        now,
      );
      const result = await upsertGeneratedReminder({
        userId: user.id,
        userCardId: userCard.id,
        reminderType: "ANNUAL_FEE",
        title: `Review annual fee for ${userCard.card.name}`,
        description:
          "Review whether this card still earns enough value before the annual fee posts.",
        dueAt,
        recurrence: "ANNUAL",
        source: "ANNUAL_FEE",
        overwriteExisting: input.overwriteExisting,
      });
      createdCount += result.created ? 1 : 0;
      updatedCount += result.updated ? 1 : 0;
      skippedCount += result.skipped ? 1 : 0;
      reminders.push(result.reminder);
    }

    if (userCard.welcomeBonusDeadline) {
      const dueAt = computeWelcomeBonusReminderDate(
        userCard.welcomeBonusDeadline,
      );
      const result = await upsertGeneratedReminder({
        userId: user.id,
        userCardId: userCard.id,
        reminderType: "WELCOME_BONUS_DEADLINE",
        title: `Check welcome bonus deadline for ${userCard.card.name}`,
        description: "Confirm your progress before the welcome bonus deadline.",
        dueAt,
        recurrence: "NONE",
        source: "WELCOME_BONUS",
        overwriteExisting: input.overwriteExisting,
      });
      createdCount += result.created ? 1 : 0;
      updatedCount += result.updated ? 1 : 0;
      skippedCount += result.skipped ? 1 : 0;
      reminders.push(result.reminder);
    }

    for (const credit of userCard.card.statementCredits) {
      const recurrence = reminderRecurrenceForCredit(credit.recurrence);
      const period = computeStatementCreditPeriod(recurrence, now);
      const dueAt = computeStatementCreditReminderDate(
        recurrence,
        period.periodStart,
        period.periodEnd,
      );
      const result = await upsertGeneratedReminder({
        userId: user.id,
        userCardId: userCard.id,
        statementCreditId: credit.id,
        reminderType: "STATEMENT_CREDIT",
        title: `Use ${credit.name} on ${userCard.card.name}`,
        description: credit.description,
        dueAt,
        recurrence,
        source: "STATEMENT_CREDIT",
        overwriteExisting: input.overwriteExisting,
      });
      createdCount += result.created ? 1 : 0;
      updatedCount += result.updated ? 1 : 0;
      skippedCount += result.skipped ? 1 : 0;
      reminders.push(result.reminder);
    }
  }

  return {
    createdCount,
    updatedCount,
    skippedCount,
    reminders: reminders.filter(Boolean),
  };
}

async function validateReminderLinks(
  user: User,
  userCardId?: string,
  statementCreditId?: string,
) {
  if (!userCardId && statementCreditId) {
    throw badRequest(
      "userCardId is required when statementCreditId is provided.",
    );
  }

  const userCard = userCardId
    ? await prisma.userCard.findFirst({
        where: { id: userCardId, userId: user.id },
      })
    : null;
  if (userCardId && !userCard) {
    throw notFound("User card not found.");
  }

  if (!statementCreditId) {
    return;
  }

  const statementCredit = await prisma.statementCredit.findUnique({
    where: { id: statementCreditId },
  });
  if (!statementCredit) {
    throw notFound("Statement credit not found.");
  }

  if (userCard && statementCredit.cardId !== userCard.cardId) {
    throw badRequest(
      "Statement credit must belong to the selected user card's card.",
    );
  }
}

async function upsertGeneratedReminder(input: {
  userId: string;
  userCardId?: string | undefined;
  statementCreditId?: string | undefined;
  reminderType: ReminderType;
  title: string;
  description?: string | null | undefined;
  dueAt: Date;
  recurrence: ReminderRecurrence;
  source: ReminderSource;
  overwriteExisting: boolean;
}) {
  const existingWhere: Prisma.ReminderWhereInput = {
    userId: input.userId,
    userCardId: input.userCardId ?? null,
    statementCreditId: input.statementCreditId ?? null,
    reminderType: input.reminderType,
    source: input.source,
    dueAt: input.dueAt,
  };
  const existing = await prisma.reminder.findFirst({
    where: existingWhere,
    include: reminderInclude,
  });

  if (existing && !input.overwriteExisting) {
    return {
      reminder: existing,
      created: false,
      updated: false,
      skipped: true,
    };
  }

  if (existing) {
    const reminder = await prisma.reminder.update({
      where: { id: existing.id },
      data: buildReminderUpdateData({
        title: input.title,
        description: input.description,
        recurrence: input.recurrence,
      }),
      include: reminderInclude,
    });
    return { reminder, created: false, updated: true, skipped: false };
  }

  const reminder = await prisma.reminder.create({
    data: buildReminderCreateData(input),
    include: reminderInclude,
  });
  return { reminder, created: true, updated: false, skipped: false };
}

function reminderRecurrenceForCredit(
  recurrence: Recurrence,
): ReminderRecurrence {
  if (recurrence === "ONE_TIME") return "NONE";
  return recurrence;
}

function buildReminderCreateData(input: {
  userId: string;
  userCardId?: string | undefined;
  statementCreditId?: string | undefined;
  reminderType: ReminderType;
  title: string;
  description?: string | null | undefined;
  dueAt: Date;
  recurrence: ReminderRecurrence;
  source: ReminderSource;
}): Prisma.ReminderUncheckedCreateInput {
  return {
    userId: input.userId,
    ...(input.userCardId ? { userCardId: input.userCardId } : {}),
    ...(input.statementCreditId
      ? { statementCreditId: input.statementCreditId }
      : {}),
    reminderType: input.reminderType,
    title: input.title,
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    dueAt: input.dueAt,
    recurrence: input.recurrence,
    source: input.source,
  };
}

function buildReminderUpdateData(input: {
  title?: string | undefined;
  description?: string | null | undefined;
  recurrence?: ReminderRecurrence | undefined;
}): Prisma.ReminderUpdateInput {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.recurrence !== undefined ? { recurrence: input.recurrence } : {}),
  };
}
