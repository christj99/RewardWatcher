import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import {
  betaCohortParamsSchema,
  betaUserListQuerySchema,
  betaUserParamsSchema,
  createBetaCohortSchema,
  createSupportNoteSchema,
  updateBetaCohortSchema,
  updateBetaUserSchema,
} from "../schemas/feedback.js";
import {
  createBetaCohort,
  createSupportNote,
  listBetaCohorts,
  listBetaUsers,
  listSupportNotes,
  updateBetaCohort,
  updateBetaUserProfile,
} from "../services/betaSupportService.js";

export async function registerAdminBetaSupportRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/beta-users", async (request) => {
    await requireAdminUser(request);
    const query = betaUserListQuerySchema.parse(request.query);
    return listBetaUsers(query);
  });

  server.patch("/v1/admin/beta-users/:userId", async (request) => {
    const admin = await requireAdminUser(request);
    const params = betaUserParamsSchema.parse(request.params);
    const body = updateBetaUserSchema.parse(request.body);
    return updateBetaUserProfile(admin, params.userId, body, request);
  });

  server.get("/v1/admin/beta-cohorts", async (request) => {
    await requireAdminUser(request);
    return listBetaCohorts();
  });

  server.post("/v1/admin/beta-cohorts", async (request, reply) => {
    const admin = await requireAdminUser(request);
    const body = createBetaCohortSchema.parse(request.body);
    void reply.status(201);
    return createBetaCohort(admin, body, request);
  });

  server.patch("/v1/admin/beta-cohorts/:id", async (request) => {
    const admin = await requireAdminUser(request);
    const params = betaCohortParamsSchema.parse(request.params);
    const body = updateBetaCohortSchema.parse(request.body);
    return updateBetaCohort(admin, params.id, body, request);
  });

  server.get("/v1/admin/users/:userId/support-notes", async (request) => {
    await requireAdminUser(request);
    const params = betaUserParamsSchema.parse(request.params);
    return listSupportNotes(params.userId);
  });

  server.post(
    "/v1/admin/users/:userId/support-notes",
    async (request, reply) => {
      const admin = await requireAdminUser(request);
      const params = betaUserParamsSchema.parse(request.params);
      const body = createSupportNoteSchema.parse(request.body);
      void reply.status(201);
      return createSupportNote(admin, params.userId, body.note, request);
    },
  );
}
