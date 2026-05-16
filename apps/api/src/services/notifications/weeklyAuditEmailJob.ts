import { EntitlementKey, NotificationType, type User } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { hasEntitlement } from "../entitlementService.js";
import { weeklyAuditTemplate } from "../email/templates.js";
import { sendTransactionalEmail } from "../email/emailService.js";
import { hasEmailPreference } from "../notificationPreferenceService.js";
import { getWeeklyAuditReport } from "../weeklyAuditService.js";

export async function sendWeeklyAuditEmails(input: {
  startDate?: string | undefined;
  endDate?: string | undefined;
  dryRun?: boolean | undefined;
  userId?: string | undefined;
}) {
  const weekEnd = input.endDate ? new Date(input.endDate) : new Date();
  const weekStart = input.startDate
    ? new Date(input.startDate)
    : new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
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
    if (!(await isWeeklyEligible(user))) {
      skippedCount += 1;
      continue;
    }
    const report = await getWeeklyAuditReport(user, {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      minMissedValueCents: 100,
      includeInconclusive: true,
      includeUnmatched: true,
      limitItems: 5,
    });
    if (report.totalOutcomes === 0 && !report.walletActions.topAction) {
      skippedCount += 1;
      continue;
    }
    const template = weeklyAuditTemplate({
      capturedValueCents: Math.round(report.estimatedValueCapturedCents),
      meaningfulMissedValueCents: Math.round(report.meaningfulMissedValueCents),
      topAction: report.walletActions.topAction,
      topMissMerchant: report.topMiss?.merchantName ?? null,
      confidenceNoteCount: report.confidenceNotes.length,
    });
    const idempotencyKey = `weekly-audit:${user.id}:${dateKey(weekStart)}:${dateKey(weekEnd)}`;
    previews.push({
      userId: user.id,
      email: user.email,
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
      emailType: "WEEKLY_AUDIT",
      subject: template.subject,
      text: template.text,
      html: template.html,
      idempotencyKey,
      metadata: { weekStart, weekEnd },
    });
    if (log.status === "SENT") sentCount += 1;
    else skippedCount += 1;
  }

  return { candidateCount: previews.length, sentCount, skippedCount, previews };
}

async function isWeeklyEligible(user: User): Promise<boolean> {
  return (
    (await hasEmailPreference(user.id, NotificationType.WEEKLY_AUDIT)) &&
    (await hasEntitlement(user.id, EntitlementKey.WEEKLY_AUDIT_REPORT))
  );
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
