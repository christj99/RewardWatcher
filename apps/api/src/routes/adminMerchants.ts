import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import {
  idParamSchema,
  merchantIdParamSchema,
} from "../schemas/adminShared.js";
import {
  adminMerchantCreateSchema,
  adminMerchantListQuerySchema,
  adminMerchantUpdateSchema,
  adminMerchantUrlPatternCreateSchema,
  adminMerchantUrlPatternUpdateSchema,
  adminPostingProfileCreateSchema,
  adminPostingProfileListQuerySchema,
  adminPostingProfileUpdateSchema,
} from "../schemas/adminMerchants.js";
import {
  createAdminMerchant,
  createAdminMerchantUrlPattern,
  createAdminPostingProfile,
  deleteAdminMerchantUrlPattern,
  getAdminMerchant,
  listAdminMerchants,
  listAdminPostingProfiles,
  updateAdminMerchant,
  updateAdminMerchantUrlPattern,
  updateAdminPostingProfile,
} from "../services/adminMerchantService.js";

export async function registerAdminMerchantRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/merchants", async (request) => {
    await requireAdminUser(request);
    const query = adminMerchantListQuerySchema.parse(request.query);
    return listAdminMerchants(query);
  });

  server.post("/v1/admin/merchants", async (request, reply) => {
    await requireAdminUser(request);
    const body = adminMerchantCreateSchema.parse(request.body);
    void reply.status(201);
    return createAdminMerchant(body);
  });

  server.get("/v1/admin/merchants/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminMerchant(params.id);
  });

  server.patch("/v1/admin/merchants/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminMerchantUpdateSchema.parse(request.body);
    return updateAdminMerchant(params.id, body);
  });

  server.post(
    "/v1/admin/merchants/:merchantId/url-patterns",
    async (request, reply) => {
      await requireAdminUser(request);
      const params = merchantIdParamSchema.parse(request.params);
      const body = adminMerchantUrlPatternCreateSchema.parse(request.body);
      void reply.status(201);
      return createAdminMerchantUrlPattern(params.merchantId, body);
    },
  );

  server.patch("/v1/admin/merchant-url-patterns/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminMerchantUrlPatternUpdateSchema.parse(request.body);
    return updateAdminMerchantUrlPattern(params.id, body);
  });

  server.delete("/v1/admin/merchant-url-patterns/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return deleteAdminMerchantUrlPattern(params.id);
  });

  server.get("/v1/admin/merchant-posting-profiles", async (request) => {
    await requireAdminUser(request);
    const query = adminPostingProfileListQuerySchema.parse(request.query);
    return listAdminPostingProfiles(query);
  });

  server.post("/v1/admin/merchant-posting-profiles", async (request, reply) => {
    await requireAdminUser(request);
    const body = adminPostingProfileCreateSchema.parse(request.body);
    void reply.status(201);
    return createAdminPostingProfile(body);
  });

  server.patch("/v1/admin/merchant-posting-profiles/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminPostingProfileUpdateSchema.parse(request.body);
    return updateAdminPostingProfile(params.id, body);
  });
}
