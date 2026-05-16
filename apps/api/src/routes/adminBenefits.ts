import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { idParamSchema } from "../schemas/adminShared.js";
import {
  adminBenefitCreateSchema,
  adminBenefitListQuerySchema,
  adminBenefitUpdateSchema,
} from "../schemas/adminBenefits.js";
import {
  createAdminBenefit,
  getAdminBenefit,
  listAdminBenefits,
  updateAdminBenefit,
} from "../services/adminBenefitService.js";

export async function registerAdminBenefitRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/benefits", async (request) => {
    await requireAdminUser(request);
    const query = adminBenefitListQuerySchema.parse(request.query);
    return listAdminBenefits(query);
  });

  server.post("/v1/admin/benefits", async (request, reply) => {
    await requireAdminUser(request);
    const body = adminBenefitCreateSchema.parse(request.body);
    void reply.status(201);
    return createAdminBenefit(body);
  });

  server.get("/v1/admin/benefits/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminBenefit(params.id);
  });

  server.patch("/v1/admin/benefits/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminBenefitUpdateSchema.parse(request.body);
    return updateAdminBenefit(params.id, body);
  });
}
