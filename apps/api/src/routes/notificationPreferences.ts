import type { FastifyInstance } from "fastify";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import { updateNotificationPreferencesSchema } from "../schemas/notificationPreferences.js";
import {
  listNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notificationPreferenceService.js";

export async function registerNotificationPreferenceRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/notification-preferences", async (request) => {
    const user = await resolveCurrentUser(request);
    return listNotificationPreferences(user);
  });

  server.patch("/v1/notification-preferences", async (request) => {
    const user = await resolveCurrentUser(request);
    const body = updateNotificationPreferencesSchema.parse(request.body);
    return updateNotificationPreferences(user, body);
  });
}
