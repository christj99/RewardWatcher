import { NotificationType } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearConsoleSentEmails,
  getConsoleSentEmails,
} from "../src/services/email/emailProvider.js";
import { sendAdminAlertEmails } from "../src/services/notifications/adminAlertJob.js";
import { sendReminderDigestEmails } from "../src/services/notifications/reminderDigestJob.js";
import { sendWeeklyAuditEmails } from "../src/services/notifications/weeklyAuditEmailJob.js";
import { buildSeededServer, prisma } from "./testUtils.js";

const adminHeaders = { "x-user-email": "admin@example.com" };
const betaHeaders = { "x-user-email": "beta@example.com" };

describe("email notifications", () => {
  beforeEach(async () => {
    clearConsoleSentEmails();
    await prisma.emailLog.deleteMany();
  });

  it("sends and logs password reset email without storing raw token metadata", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "POST",
      url: "/v1/auth/password-reset/request",
      payload: { email: "beta@example.com" },
    });
    const body = response.json() as { devResetToken?: string };
    const log = await prisma.emailLog.findFirst({
      where: { emailType: "PASSWORD_RESET" },
    });

    expect(response.statusCode).toBe(200);
    expect(body.devResetToken).toBeTruthy();
    expect(log?.status).toBe("SENT");
    expect(log?.toEmailRedacted).toBe("b***@example.com");
    expect(JSON.stringify(log?.metadata)).not.toContain(body.devResetToken);
    expect(getConsoleSentEmails()[0]?.text).toContain("/reset-password?token=");

    await server.close();
  });

  it("manages notification preferences and protects required transactional types", async () => {
    const server = await buildSeededServer();
    const user = await prisma.user.create({
      data: {
        email: `notification-preferences-${Date.now()}@example.com`,
        displayName: "Notification Preferences Test",
      },
    });
    const headers = { "x-user-email": user.email };
    const preferences = await server.inject({
      method: "GET",
      url: "/v1/notification-preferences",
      headers,
    });
    const updated = await server.inject({
      method: "PATCH",
      url: "/v1/notification-preferences",
      headers,
      payload: {
        preferences: [
          {
            channel: "EMAIL",
            notificationType: NotificationType.WEEKLY_AUDIT,
            enabled: false,
          },
        ],
      },
    });
    const blocked = await server.inject({
      method: "PATCH",
      url: "/v1/notification-preferences",
      headers,
      payload: {
        preferences: [
          {
            channel: "EMAIL",
            notificationType: NotificationType.PASSWORD_RESET,
            enabled: false,
          },
        ],
      },
    });

    expect(preferences.statusCode).toBe(200);
    expect(preferences.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ notificationType: "WEEKLY_AUDIT" }),
      ]),
    );
    expect(updated.statusCode).toBe(200);
    expect(
      updated
        .json()
        .find(
          (preference: { notificationType: string }) =>
            preference.notificationType === "WEEKLY_AUDIT",
        ).enabled,
    ).toBe(false);
    expect(blocked.statusCode).toBe(400);

    await server.close();
  });

  it("weekly audit email job sends once per user and week", async () => {
    const server = await buildSeededServer();
    const beta = await prisma.user.findUniqueOrThrow({
      where: { email: "beta@example.com" },
    });
    await prisma.notificationPreference.upsert({
      where: {
        userId_channel_notificationType: {
          userId: beta.id,
          channel: "EMAIL",
          notificationType: "WEEKLY_AUDIT",
        },
      },
      create: {
        userId: beta.id,
        channel: "EMAIL",
        notificationType: "WEEKLY_AUDIT",
        enabled: true,
      },
      update: { enabled: true },
    });
    await prisma.reminder.create({
      data: {
        userId: beta.id,
        reminderType: "CUSTOM",
        title: "Check annual fee",
        dueAt: new Date("2026-05-10T00:00:00.000Z"),
        recurrence: "NONE",
      },
    });

    const first = await sendWeeklyAuditEmails({
      userId: beta.id,
      startDate: "2026-05-04T00:00:00.000Z",
      endDate: "2026-05-11T00:00:00.000Z",
    });
    const second = await sendWeeklyAuditEmails({
      userId: beta.id,
      startDate: "2026-05-04T00:00:00.000Z",
      endDate: "2026-05-11T00:00:00.000Z",
    });
    const logs = await prisma.emailLog.findMany({
      where: { emailType: "WEEKLY_AUDIT" },
    });

    expect(first.candidateCount).toBe(1);
    expect(second.sentCount).toBe(0);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("SENT");

    await server.close();
  });

  it("reminder digest sends due reminders and respects idempotency", async () => {
    const server = await buildSeededServer();
    const beta = await prisma.user.findUniqueOrThrow({
      where: { email: "beta@example.com" },
    });
    await prisma.reminder.create({
      data: {
        userId: beta.id,
        reminderType: "CUSTOM",
        title: "Use dining credit",
        dueAt: new Date("2026-05-11T00:00:00.000Z"),
        recurrence: "NONE",
      },
    });

    const first = await sendReminderDigestEmails({
      userId: beta.id,
      now: new Date("2026-05-11T12:00:00.000Z"),
    });
    const second = await sendReminderDigestEmails({
      userId: beta.id,
      now: new Date("2026-05-11T12:00:00.000Z"),
    });

    expect(first.candidateCount).toBe(1);
    expect(second.sentCount).toBe(0);
    expect(
      await prisma.emailLog.count({ where: { emailType: "REMINDER_DIGEST" } }),
    ).toBe(1);

    await server.close();
  });

  it("admin alert job sends operational alert and admin can list email logs", async () => {
    const server = await buildSeededServer();
    await prisma.curatorReviewTask.create({
      data: {
        taskType: "OTHER",
        priority: "HIGH",
        status: "OPEN",
        title: "High priority email alert test",
      },
    });
    const result = await sendAdminAlertEmails({
      toEmails: ["ops@example.com"],
    });
    const nonAdmin = await server.inject({
      method: "GET",
      url: "/v1/admin/email-logs",
      headers: betaHeaders,
    });
    const admin = await server.inject({
      method: "GET",
      url: "/v1/admin/email-logs?emailType=ADMIN_ALERT",
      headers: adminHeaders,
    });

    expect(result.sentCount).toBe(1);
    expect(nonAdmin.statusCode).toBe(403);
    expect(admin.statusCode).toBe(200);
    expect(admin.json()[0]).toMatchObject({
      emailType: "ADMIN_ALERT",
      toEmailRedacted: "o***@example.com",
    });

    await server.close();
  });
});
