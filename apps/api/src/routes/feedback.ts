import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  adminFeedbackListQuerySchema,
  feedbackListQuerySchema,
  feedbackParamsSchema,
  createFeedbackSchema,
  updateFeedbackSchema,
} from "../schemas/feedback.js";
import {
  createFeedbackReport,
  getAdminFeedback,
  getUserFeedback,
  listAdminFeedback,
  listUserFeedback,
  updateAdminFeedback,
} from "../services/feedbackService.js";

export async function registerFeedbackRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.post("/v1/feedback", async (request, reply) => {
    const user = await resolveCurrentUser(request);
    const body = createFeedbackSchema.parse(request.body);
    const report = await createFeedbackReport(user, body, request);
    void reply.status(201);
    return report;
  });

  server.get("/v1/feedback", async (request) => {
    const user = await resolveCurrentUser(request);
    const query = feedbackListQuerySchema.parse(request.query);
    return listUserFeedback(user, query);
  });

  server.get("/v1/feedback/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = feedbackParamsSchema.parse(request.params);
    return getUserFeedback(user, params.id);
  });

  server.get("/v1/admin/feedback", async (request) => {
    await requireAdminUser(request);
    const query = adminFeedbackListQuerySchema.parse(request.query);
    return listAdminFeedback(query);
  });

  server.get("/v1/admin/feedback/:id", async (request) => {
    await requireAdminUser(request);
    const params = feedbackParamsSchema.parse(request.params);
    return getAdminFeedback(params.id);
  });

  server.patch("/v1/admin/feedback/:id", async (request) => {
    const admin = await requireAdminUser(request);
    const params = feedbackParamsSchema.parse(request.params);
    const body = updateFeedbackSchema.parse(request.body);
    return updateAdminFeedback(admin, params.id, body, request);
  });
}
