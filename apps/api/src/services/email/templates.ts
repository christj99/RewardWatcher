import { env } from "../../config/env.js";

export function passwordResetTemplate(input: {
  resetToken: string;
  expiresMinutes: number;
}) {
  const resetUrl = `${env.APP_WEB_URL}/reset-password?token=${encodeURIComponent(input.resetToken)}`;
  const subject = "Reset your Rewards Audit password";
  const text = [
    "A password reset was requested for your Rewards Audit account.",
    "",
    `Reset your password here: ${resetUrl}`,
    "",
    `This link expires in ${input.expiresMinutes} minutes.`,
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  return {
    subject,
    text,
    html: simpleHtml(
      subject,
      `<p>A password reset was requested for your Rewards Audit account.</p><p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p><p>This link expires in ${input.expiresMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
    ),
  };
}

export function weeklyAuditTemplate(input: {
  capturedValueCents: number;
  meaningfulMissedValueCents: number;
  topAction?: { title: string; description?: string | null } | null;
  topMissMerchant?: string | null;
  confidenceNoteCount: number;
}) {
  const subject = "Your weekly rewards audit";
  const lines = [
    "Here's what we found this week.",
    "",
    `Captured value: ${formatMoney(input.capturedValueCents)}`,
    `Meaningful missed value: ${formatMoney(input.meaningfulMissedValueCents)}`,
  ];
  if (input.topAction) {
    lines.push("", `Top action: ${input.topAction.title}`);
    if (input.topAction.description) lines.push(input.topAction.description);
  }
  if (input.topMissMerchant) {
    lines.push("", `Top miss: ${input.topMissMerchant}`);
  }
  if (input.confidenceNoteCount > 0) {
    lines.push(
      "",
      `${input.confidenceNoteCount} item(s) include confidence caveats.`,
    );
  }
  lines.push("", `Open your report: ${env.APP_WEB_URL}/audit/weekly`);
  lines.push("", "Privacy note: this summary avoids raw transaction details.");
  return {
    subject,
    text: lines.join("\n"),
    html: simpleHtml(
      subject,
      `<p>Here's what we found this week.</p><ul><li>Captured value: ${formatMoney(input.capturedValueCents)}</li><li>Meaningful missed value: ${formatMoney(input.meaningfulMissedValueCents)}</li></ul>${input.topAction ? `<p><strong>Top action:</strong> ${escapeHtml(input.topAction.title)}</p>` : ""}<p><a href="${env.APP_WEB_URL}/audit/weekly">Open your weekly audit</a></p><p>Privacy note: this summary avoids raw transaction details.</p>`,
    ),
  };
}

export function reminderDigestTemplate(input: {
  reminders: Array<{ title: string; dueAt: Date; description?: string | null }>;
}) {
  const subject = "Rewards reminders coming up";
  const shown = input.reminders.slice(0, 5);
  const text = [
    "You have rewards reminders coming up.",
    "",
    ...shown.map(
      (reminder) =>
        `- ${reminder.title} (${reminder.dueAt.toISOString().slice(0, 10)})`,
    ),
    "",
    `Review reminders: ${env.APP_WEB_URL}/reminders`,
  ].join("\n");
  return {
    subject,
    text,
    html: simpleHtml(
      subject,
      `<p>You have rewards reminders coming up.</p><ul>${shown
        .map(
          (reminder) =>
            `<li>${escapeHtml(reminder.title)} (${reminder.dueAt.toISOString().slice(0, 10)})</li>`,
        )
        .join(
          "",
        )}</ul><p><a href="${env.APP_WEB_URL}/reminders">Review reminders</a></p>`,
    ),
  };
}

export function adminAlertTemplate(input: {
  highPriorityTaskCount: number;
  recommendationErrorCount: number;
  plaidFailureCount: number;
}) {
  const subject = "Rewards Audit admin alert";
  const text = [
    "Admin attention may be needed.",
    "",
    `High-priority review tasks: ${input.highPriorityTaskCount}`,
    `Recommendation errors in last 7 days: ${input.recommendationErrorCount}`,
    `Plaid sync failures in last 24 hours: ${input.plaidFailureCount}`,
    "",
    `Open admin dashboard: ${env.ADMIN_WEB_URL}`,
  ].join("\n");
  return {
    subject,
    text,
    html: simpleHtml(
      subject,
      `<p>Admin attention may be needed.</p><ul><li>High-priority review tasks: ${input.highPriorityTaskCount}</li><li>Recommendation errors in last 7 days: ${input.recommendationErrorCount}</li><li>Plaid sync failures in last 24 hours: ${input.plaidFailureCount}</li></ul><p><a href="${env.ADMIN_WEB_URL}">Open admin dashboard</a></p>`,
    ),
  };
}

function simpleHtml(title: string, body: string): string {
  return `<!doctype html><html><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
