import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { idParamSchema } from "../schemas/adminShared.js";
import {
  adminIssuerCreateSchema,
  adminIssuerListQuerySchema,
  adminIssuerUpdateSchema,
} from "../schemas/adminIssuers.js";
import {
  createAdminIssuer,
  getAdminIssuer,
  listAdminIssuers,
  updateAdminIssuer,
} from "../services/adminIssuerService.js";

export async function registerAdminIssuerRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/issuers", async (request) => {
    await requireAdminUser(request);
    const query = adminIssuerListQuerySchema.parse(request.query);
    return listAdminIssuers(query);
  });

  server.post("/v1/admin/issuers", async (request, reply) => {
    await requireAdminUser(request);
    const body = adminIssuerCreateSchema.parse(request.body);
    void reply.status(201);
    return createAdminIssuer(body);
  });

  server.get("/v1/admin/issuers/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminIssuer(params.id);
  });

  server.patch("/v1/admin/issuers/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminIssuerUpdateSchema.parse(request.body);
    return updateAdminIssuer(params.id, body);
  });
}
