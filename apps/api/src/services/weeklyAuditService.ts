import type { Prisma, RecommendationOutcome, User } from "@prisma/client";
import {
  buildWeeklyAuditReport,
  summarizeReminderUrgency,
  type WeeklyAuditOutcomeInput,
} from "@rewards-audit/rewards-engine";

import { prisma } from "@rewards-audit/db";

const weeklyOutcomeInclude = {
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

type WeeklyOutcome = Prisma.RecommendationOutcomeGetPayload<{
  include: typeof weeklyOutcomeInclude;
}>;

const walletActionReminderInclude = {
  userCard: { include: { card: true } },
  statementCredit: true,
} satisfies Prisma.ReminderInclude;

const walletActionUsageInclude = {
  userCard: { include: { card: true } },
  statementCredit: true,
} satisfies Prisma.StatementCreditUsageInclude;

type WalletActionReminder = Prisma.ReminderGetPayload<{
  include: typeof walletActionReminderInclude;
}>;

type WalletActionUsage = Prisma.StatementCreditUsageGetPayload<{
  include: typeof walletActionUsageInclude;
}>;

export async function getWeeklyAuditReport(
  user: User,
  input: {
    weekStart?: string | undefined;
    weekEnd?: string | undefined;
    minMissedValueCents: number;
    includeInconclusive: boolean;
    includeUnmatched: boolean;
    limitItems: number;
  },
) {
  const { weekStart, weekEnd } = resolveRange(input.weekStart, input.weekEnd);
  const outcomes = await prisma.recommendationOutcome.findMany({
    where: {
      userId: user.id,
      OR: [
        {
          transaction: {
            transactionDate: {
              gte: weekStart,
              lt: weekEnd,
            },
          },
        },
      ],
    },
    include: weeklyOutcomeInclude,
    orderBy: [{ computedAt: "desc" }, { id: "asc" }],
  });

  const report = buildWeeklyAuditReport({
    weekStart,
    weekEnd,
    minMissedValueCents: input.minMissedValueCents,
    includeInconclusive: input.includeInconclusive,
    includeUnmatched: input.includeUnmatched,
    limitItems: input.limitItems,
    outcomes: outcomes.map(mapOutcome),
  });

  return {
    ...report,
    walletActions: await buildWalletActions(user.id, weekStart, weekEnd),
  };
}

function resolveRange(
  weekStartInput?: string,
  weekEndInput?: string,
): { weekStart: Date; weekEnd: Date } {
  if (weekStartInput && weekEndInput) {
    return {
      weekStart: new Date(weekStartInput),
      weekEnd: new Date(weekEndInput),
    };
  }

  const weekEnd = new Date();
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 7);

  return { weekStart, weekEnd };
}

function mapOutcome(outcome: WeeklyOutcome): WeeklyAuditOutcomeInput {
  return {
    outcomeId: outcome.id,
    transactionId: outcome.transactionId,
    recommendationEventId: outcome.recommendationEventId,
    transactionDate:
      outcome.transaction?.transactionDate ??
      outcome.computedAt ??
      outcome.createdAt,
    merchantName:
      outcome.transaction?.merchant?.name ??
      outcome.transaction?.normalizedMerchantName ??
      outcome.transaction?.rawMerchantName ??
      outcome.recommendationEvent?.merchant?.name ??
      outcome.recommendationEvent?.merchantNameInput ??
      "Unknown merchant",
    amountCents: outcome.transaction?.amountCents ?? 0,
    outcomeType: outcome.outcomeType,
    confidence: outcome.confidence,
    explanation: outcome.explanation,
    actualCard: cardSummary(
      outcome.actualUserCard ?? outcome.transaction?.userCard,
    ),
    bestCard: cardSummary(outcome.bestUserCard),
    recommendedCard:
      cardSummary(outcome.recommendedUserCard) ??
      directCardSummary(outcome.recommendationEvent?.recommendedCard),
    capturedValueCents: decimalToNumber(outcome.capturedValueCents),
    missedValueCents: decimalToNumber(outcome.missedValueCents),
    expectedValueCents: decimalToNumber(outcome.expectedValueCents),
    warnings: [],
  };
}

function cardSummary(
  userCard:
    | WeeklyOutcome["actualUserCard"]
    | WeeklyOutcome["transaction"]["userCard"],
) {
  if (!userCard) {
    return null;
  }

  return {
    id: userCard.card.id,
    name: userCard.card.name,
    issuerName: userCard.card.issuer.name,
  };
}

function directCardSummary(
  card:
    | NonNullable<WeeklyOutcome["recommendationEvent"]>["recommendedCard"]
    | undefined,
) {
  if (!card) {
    return null;
  }

  return {
    id: card.id,
    name: card.name,
    issuerName: card.issuer.name,
  };
}

function decimalToNumber(
  value: RecommendationOutcome["capturedValueCents"],
): number | null {
  return value === null ? null : Number(value.toString());
}

async function buildWalletActions(
  userId: string,
  weekStart: Date,
  weekEnd: Date,
) {
  const now = new Date();
  const reminders = await prisma.reminder.findMany({
    where: {
      userId,
      status: { in: ["SCHEDULED", "DUE"] },
      dueAt: {
        lt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    },
    include: walletActionReminderInclude,
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
  });
  const usages = await prisma.statementCreditUsage.findMany({
    where: {
      userId,
      status: { in: ["UNUSED", "PARTIALLY_USED"] },
      periodStart: { lt: weekEnd },
      periodEnd: { gt: weekStart },
    },
    include: walletActionUsageInclude,
    orderBy: [{ periodEnd: "asc" }, { id: "asc" }],
  });
  const overdue = reminders.filter(
    (reminder) => summarizeReminderUrgency(reminder, now) === "OVERDUE",
  );
  const dueSoon = reminders.filter(
    (reminder) => summarizeReminderUrgency(reminder, now) === "DUE_SOON",
  );
  const welcomeSoon = dueSoon.filter(
    (reminder) => reminder.reminderType === "WELCOME_BONUS_DEADLINE",
  );

  return {
    overdueReminderCount: overdue.length,
    dueSoonReminderCount: dueSoon.length,
    unusedStatementCreditCount: usages.filter(
      (usage) => usage.status === "UNUSED",
    ).length,
    upcomingWelcomeBonusDeadlineCount: reminders.filter(
      (reminder) => reminder.reminderType === "WELCOME_BONUS_DEADLINE",
    ).length,
    topAction:
      actionFromReminder(overdue[0], "REMINDER") ??
      actionFromReminder(welcomeSoon[0], "WELCOME_BONUS") ??
      actionFromUsage(usages[0]) ??
      actionFromReminder(dueSoon[0], "REMINDER") ??
      null,
  };
}

function actionFromReminder(
  reminder: WalletActionReminder | undefined,
  type: "REMINDER" | "WELCOME_BONUS",
) {
  if (!reminder) return null;
  return {
    type,
    title: reminder.title,
    description: reminder.description,
    dueAt: reminder.dueAt.toISOString(),
  };
}

function actionFromUsage(usage: WalletActionUsage | undefined) {
  if (!usage) return null;
  return {
    type: "STATEMENT_CREDIT" as const,
    title: `Check ${usage.statementCredit.name}`,
    description: `Estimated remaining value: ${usage.estimatedRemainingCents ?? usage.statementCredit.amountCents} cents.`,
    dueAt: usage.periodEnd.toISOString(),
  };
}
