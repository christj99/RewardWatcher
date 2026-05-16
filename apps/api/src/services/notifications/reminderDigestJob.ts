import { NotificationType } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { sendTransactionalEmail } from "../email/emailService.js";
import { reminderDigestTemplate } from "../email/templates.js";
import { hasEmailPreference } from "../notificationPreferenceService.js";

export async function sendReminderDigestEmails(input: {
  now?: Date | undefined;
  lookaheadDays?: number | undefined;
  dryRun?: boolean | undefined;
  userId?: string | undefined;
}) {
  const now = input.now ?? new Date();
  const lookaheadDays = input.lookaheadDays ?? 7;
  const dueBefore = new Date(
    now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000,
  );
  const users = await prisma.user.findMany({
    where: {
      ...(input.userId ? { id: input.userId } : {}),
      email: { not: { contains: "@deleted.local" } },
    },
    orderBy: { createdAt: "asc" },
  });
  const previews = [];
  let sentCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    if (
      !(await hasEmailPreference(user.id, NotificationType.REMINDER_DIGEST))
    ) {
      skippedCount += 1;
      continue;
    }
    const reminders = await prisma.reminder.findMany({
      where: {
        userId: user.id,
        status: { in: ["SCHEDULED", "DUE"] },
        dueAt: { lte: dueBefore },
      },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      take: 20,
    });
    if (reminders.length === 0) {
      skippedCount += 1;
      continue;
    }
    await prisma.reminder.updateMany({
      where: {
        userId: user.id,
        status: "SCHEDULED",
        dueAt: { lte: now },
      },
      data: { status: "DUE", lastTriggeredAt: now },
    });
    const template = reminderDigestTemplate({ reminders });
    const idempotencyKey = `reminder-digest:${user.id}:${dateKey(now)}`;
    previews.push({
      userId: user.id,
      email: user.email,
      reminderCount: reminders.length,
      subject: template.subject,
    });
    if (input.dryRun) continue;
    const existing = await prisma.emailLog.findUnique({
      where: { idempotencyKey },
    });
    if (existing?.status === "SENT") {
      skippedCount += 1;
      continue;
    }
    const log = await sendTransactionalEmail({
      userId: user.id,
      to: user.email,
      emailType: "REMINDER_DIGEST",
      subject: template.subject,
      text: template.text,
      html: template.html,
      idempotencyKey,
      metadata: { lookaheadDays, reminderCount: reminders.length },
    });
    if (log.status === "SENT") sentCount += 1;
    else skippedCount += 1;
  }

  return { candidateCount: previews.length, sentCount, skippedCount, previews };
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
