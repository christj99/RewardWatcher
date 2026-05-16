import {
  NotificationChannel,
  NotificationType,
  type User,
} from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { badRequest } from "../lib/httpErrors.js";

export const defaultEmailNotificationTypes = [
  NotificationType.PASSWORD_RESET,
  NotificationType.WEEKLY_AUDIT,
  NotificationType.REMINDER_DIGEST,
  NotificationType.BILLING_NOTICE,
  NotificationType.PRIVACY_NOTICE,
] as const;

const alwaysEnabled = new Set<NotificationType>([
  NotificationType.PASSWORD_RESET,
  NotificationType.PRIVACY_NOTICE,
]);

export async function ensureDefaultNotificationPreferences(userId: string) {
  await Promise.all(
    defaultEmailNotificationTypes.map((notificationType) =>
      prisma.notificationPreference.upsert({
        where: {
          userId_channel_notificationType: {
            userId,
            channel: NotificationChannel.EMAIL,
            notificationType,
          },
        },
        create: {
          userId,
          channel: NotificationChannel.EMAIL,
          notificationType,
          enabled: true,
        },
        update: {},
      }),
    ),
  );
}

export async function listNotificationPreferences(user: User) {
  await ensureDefaultNotificationPreferences(user.id);
  return prisma.notificationPreference.findMany({
    where: { userId: user.id },
    orderBy: [{ notificationType: "asc" }],
  });
}

export async function updateNotificationPreferences(
  user: User,
  input: {
    preferences: Array<{
      channel: NotificationChannel;
      notificationType: NotificationType;
      enabled: boolean;
    }>;
  },
) {
  for (const preference of input.preferences) {
    if (!preference.enabled && alwaysEnabled.has(preference.notificationType)) {
      throw badRequest(
        `${preference.notificationType} notifications cannot be disabled.`,
      );
    }
  }

  await Promise.all(
    input.preferences.map((preference) =>
      prisma.notificationPreference.upsert({
        where: {
          userId_channel_notificationType: {
            userId: user.id,
            channel: preference.channel,
            notificationType: preference.notificationType,
          },
        },
        create: {
          userId: user.id,
          channel: preference.channel,
          notificationType: preference.notificationType,
          enabled: preference.enabled,
        },
        update: { enabled: preference.enabled },
      }),
    ),
  );
  return listNotificationPreferences(user);
}

export async function hasEmailPreference(
  userId: string,
  notificationType: NotificationType,
): Promise<boolean> {
  if (alwaysEnabled.has(notificationType)) return true;
  await ensureDefaultNotificationPreferences(userId);
  const preference = await prisma.notificationPreference.findUnique({
    where: {
      userId_channel_notificationType: {
        userId,
        channel: NotificationChannel.EMAIL,
        notificationType,
      },
    },
  });
  return preference?.enabled ?? true;
}
