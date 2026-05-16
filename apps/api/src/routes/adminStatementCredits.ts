import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { idParamSchema } from "../schemas/adminShared.js";
import {
  adminStatementCreditCreateSchema,
  adminStatementCreditListQuerySchema,
  adminStatementCreditUpdateSchema,
} from "../schemas/adminStatementCredits.js";
import {
  createAdminStatementCredit,
  getAdminStatementCredit,
  listAdminStatementCredits,
  updateAdminStatementCredit,
} from "../services/adminStatementCreditService.js";

export async function registerAdminStatementCreditRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/statement-credits", async (request) => {
    await requireAdminUser(request);
    const query = adminStatementCreditListQuerySchema.parse(request.query);
    return listAdminStatementCredits(query);
  });

  server.post("/v1/admin/statement-credits", async (request, reply) => {
    await requireAdminUser(request);
    const body = adminStatementCreditCreateSchema.parse(request.body);
    void reply.status(201);
    return createAdminStatementCredit(body);
  });

  server.get("/v1/admin/statement-credits/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminStatementCredit(params.id);
  });

  server.patch("/v1/admin/statement-credits/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminStatementCreditUpdateSchema.parse(request.body);
    return updateAdminStatementCredit(params.id, body);
  });
}
