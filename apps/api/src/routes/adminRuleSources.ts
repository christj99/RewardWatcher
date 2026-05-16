import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { idParamSchema } from "../schemas/adminShared.js";
import {
  adminRuleSourceCreateSchema,
  adminRuleSourceListQuerySchema,
  adminRuleSourceUpdateSchema,
} from "../schemas/adminRuleSources.js";
import {
  createAdminRuleSource,
  getAdminRuleSource,
  listAdminRuleSources,
  updateAdminRuleSource,
} from "../services/adminRuleSourceService.js";

export async function registerAdminRuleSourceRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/rule-sources", async (request) => {
    await requireAdminUser(request);
    const query = adminRuleSourceListQuerySchema.parse(request.query);
    return listAdminRuleSources(query);
  });

  server.post("/v1/admin/rule-sources", async (request, reply) => {
    await requireAdminUser(request);
    const body = adminRuleSourceCreateSchema.parse(request.body);
    void reply.status(201);
    return createAdminRuleSource(body);
  });

  server.get("/v1/admin/rule-sources/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminRuleSource(params.id);
  });

  server.patch("/v1/admin/rule-sources/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminRuleSourceUpdateSchema.parse(request.body);
    return updateAdminRuleSource(params.id, body);
  });
}
