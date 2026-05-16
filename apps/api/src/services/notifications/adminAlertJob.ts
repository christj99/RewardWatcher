import { env } from "../../config/env.js";
import { sendTransactionalEmail } from "../email/emailService.js";
import { adminAlertTemplate } from "../email/templates.js";
import { prisma } from "@rewards-audit/db";

export async function sendAdminAlertEmails(input: {
  dryRun?: boolean | undefined;
  toEmails?: string[] | undefined;
}) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [highPriorityTaskCount, recommendationErrorCount, plaidFailureCount] =
    await Promise.all([
      prisma.curatorReviewTask.count({
        where: { priority: "HIGH", status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.recommendationOutcome.count({
        where: {
          outcomeType: "RECOMMENDATION_ERROR",
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.plaidSyncRun.count({
        where: { status: "FAILED", createdAt: { gte: oneDayAgo } },
      }),
    ]);

  const shouldSend =
    highPriorityTaskCount > 0 ||
    recommendationErrorCount >=
      env.ADMIN_RECOMMENDATION_ERROR_ALERT_THRESHOLD ||
    plaidFailureCount > 0;
  const recipients = await resolveAdminRecipients(input.toEmails);
  const template = adminAlertTemplate({
    highPriorityTaskCount,
    recommendationErrorCount,
    plaidFailureCount,
  });
  const previews = recipients.map((email) => ({
    email,
    subject: template.subject,
    highPriorityTaskCount,
    recommendationErrorCount,
    plaidFailureCount,
  }));

  if (!shouldSend || recipients.length === 0) {
    return {
      candidateCount: recipients.length,
      sentCount: 0,
      skippedCount: recipients.length,
      previews,
    };
  }
  if (input.dryRun) {
    return {
      candidateCount: recipients.length,
      sentCount: 0,
      skippedCount: 0,
      previews,
    };
  }

  let sentCount = 0;
  let skippedCount = 0;
  await Promise.all(
    recipients.map(async (email) => {
      const idempotencyKey = `admin-alert:${dateKey(now)}:${email}`;
      const existing = await prisma.emailLog.findUnique({
        where: { idempotencyKey },
      });
      if (existing?.status === "SENT") {
        skippedCount += 1;
        return;
      }
      const log = await sendTransactionalEmail({
        to: email,
        emailType: "ADMIN_ALERT",
        subject: template.subject,
        text: template.text,
        html: template.html,
        idempotencyKey,
        metadata: {
          highPriorityTaskCount,
          recommendationErrorCount,
          syncFailureCount: plaidFailureCount,
        },
      });
      if (log.status === "SENT") sentCount += 1;
      else skippedCount += 1;
    }),
  );
  return {
    candidateCount: recipients.length,
    sentCount,
    skippedCount,
    previews,
  };
}

async function resolveAdminRecipients(
  override?: string[] | undefined,
): Promise<string[]> {
  if (override?.length) return override;
  if (env.ADMIN_ALERT_EMAILS) {
    return env.ADMIN_ALERT_EMAILS.split(",")
      .map((email) => email.trim())
      .filter(Boolean);
  }
  const admins = await prisma.user.findMany({
    where: { isAdmin: true },
    select: { email: true },
  });
  return admins.map((admin) => admin.email);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
