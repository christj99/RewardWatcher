import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { recordAdminAuditLog } from "../services/adminAuditLogService.js";
import { cardIdParamSchema, idParamSchema } from "../schemas/adminShared.js";
import {
  adminCardCreateSchema,
  adminCardListQuerySchema,
  adminCardUpdateSchema,
  adminCardVersionCreateSchema,
  adminCardVersionUpdateSchema,
} from "../schemas/adminCards.js";
import {
  createAdminCard,
  createAdminCardVersion,
  getAdminCard,
  getAdminCardVersion,
  listAdminCards,
  listAdminCardVersions,
  updateAdminCard,
  updateAdminCardVersion,
} from "../services/adminCardService.js";

export async function registerAdminCardRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/cards", async (request) => {
    await requireAdminUser(request);
    const query = adminCardListQuerySchema.parse(request.query);
    return listAdminCards(query);
  });

  server.post("/v1/admin/cards", async (request, reply) => {
    const admin = await requireAdminUser(request);
    const body = adminCardCreateSchema.parse(request.body);
    const card = await createAdminCard(body);
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "CREATE",
      entityType: "Card",
      entityId: card.id,
      after: card,
      request,
    });
    void reply.status(201);
    return card;
  });

  server.get("/v1/admin/cards/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminCard(params.id);
  });

  server.patch("/v1/admin/cards/:id", async (request) => {
    const admin = await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminCardUpdateSchema.parse(request.body);
    const before = await getAdminCard(params.id);
    const after = await updateAdminCard(params.id, body);
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "UPDATE",
      entityType: "Card",
      entityId: params.id,
      before,
      after,
      request,
    });
    return after;
  });

  server.get("/v1/admin/cards/:cardId/versions", async (request) => {
    await requireAdminUser(request);
    const params = cardIdParamSchema.parse(request.params);
    return listAdminCardVersions(params.cardId);
  });

  server.post("/v1/admin/cards/:cardId/versions", async (request, reply) => {
    const admin = await requireAdminUser(request);
    const params = cardIdParamSchema.parse(request.params);
    const body = adminCardVersionCreateSchema.parse(request.body);
    const version = await createAdminCardVersion(params.cardId, body);
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "CREATE",
      entityType: "CardVersion",
      entityId: version.id,
      after: version,
      request,
    });
    void reply.status(201);
    return version;
  });

  server.get("/v1/admin/card-versions/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminCardVersion(params.id);
  });

  server.patch("/v1/admin/card-versions/:id", async (request) => {
    const admin = await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminCardVersionUpdateSchema.parse(request.body);
    const before = await getAdminCardVersion(params.id);
    const after = await updateAdminCardVersion(params.id, body);
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "UPDATE",
      entityType: "CardVersion",
      entityId: params.id,
      before,
      after,
      request,
    });
    return after;
  });
}
