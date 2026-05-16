import type { FastifyInstance } from "fastify";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  createReminderSchema,
  generateDefaultRemindersSchema,
  listRemindersQuerySchema,
  reminderParamsSchema,
  updateReminderSchema,
} from "../schemas/reminders.js";
import {
  createReminder,
  dismissReminder,
  generateDefaultReminders,
  getReminder,
  listReminders,
  updateReminder,
} from "../services/reminderService.js";

export async function registerReminderRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/reminders", async (request) => {
    const user = await resolveCurrentUser(request);
    const query = listRemindersQuerySchema.parse(request.query);
    return listReminders(user, query);
  });

  server.post("/v1/reminders", async (request, reply) => {
    const user = await resolveCurrentUser(request);
    const body = createReminderSchema.parse(request.body);
    const reminder = await createReminder(user, body);
    void reply.status(201);
    return reminder;
  });

  server.get("/v1/reminders/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = reminderParamsSchema.parse(request.params);
    return getReminder(user, params.id);
  });

  server.patch("/v1/reminders/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = reminderParamsSchema.parse(request.params);
    const body = updateReminderSchema.parse(request.body);
    return updateReminder(user, params.id, body);
  });

  server.delete("/v1/reminders/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = reminderParamsSchema.parse(request.params);
    return dismissReminder(user, params.id);
  });

  server.post("/v1/reminders/generate-defaults", async (request) => {
    const user = await resolveCurrentUser(request);
    const body = generateDefaultRemindersSchema.parse(request.body ?? {});
    return generateDefaultReminders(user, body);
  });
}
