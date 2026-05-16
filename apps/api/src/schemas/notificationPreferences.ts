import { NotificationChannel, NotificationType } from "@prisma/client";
import { z } from "zod";

export const updateNotificationPreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        channel: z.nativeEnum(NotificationChannel),
        notificationType: z.nativeEnum(NotificationType),
        enabled: z.boolean(),
      }),
    )
    .min(1),
});
