import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { recordAdminAuditLog } from "../services/adminAuditLogService.js";
import { idParamSchema } from "../schemas/adminShared.js";
import {
  adminOfferCreateSchema,
  adminOfferExpireSchema,
  adminOfferListQuerySchema,
  adminOfferUpdateSchema,
} from "../schemas/adminOffers.js";
import {
  createAdminOffer,
  expireAdminOffer,
  getAdminOffer,
  listAdminOffers,
  updateAdminOffer,
} from "../services/adminOfferService.js";

export async function registerAdminOfferRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/offers", async (request) => {
    await requireAdminUser(request);
    const query = adminOfferListQuerySchema.parse(request.query);
    return listAdminOffers(query);
  });

  server.post("/v1/admin/offers", async (request, reply) => {
    const admin = await requireAdminUser(request);
    const body = adminOfferCreateSchema.parse(request.body);
    const offer = await createAdminOffer(body);
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "CREATE",
      entityType: "IssuerOffer",
      entityId: offer.id,
      after: offer,
      request,
    });
    void reply.status(201);
    return offer;
  });

  server.get("/v1/admin/offers/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminOffer(params.id);
  });

  server.patch("/v1/admin/offers/:id", async (request) => {
    const admin = await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminOfferUpdateSchema.parse(request.body);
    const before = await getAdminOffer(params.id);
    const after = await updateAdminOffer(params.id, body);
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "UPDATE",
      entityType: "IssuerOffer",
      entityId: params.id,
      before,
      after,
      request,
    });
    return after;
  });

  server.post("/v1/admin/offers/:id/expire", async (request) => {
    const admin = await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminOfferExpireSchema.parse(request.body);
    const before = await getAdminOffer(params.id);
    const after = await expireAdminOffer(params.id, body);
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "EXPIRE",
      entityType: "IssuerOffer",
      entityId: params.id,
      before,
      after,
      request,
    });
    return after;
  });
}
