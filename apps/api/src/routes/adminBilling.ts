import type { FastifyInstance } from "fastify";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import { requireAdminUser } from "../plugins/adminGuard.js";
import {
  adminBillingUsersQuerySchema,
  entitlementGrantParamsSchema,
  grantEntitlementSchema,
  updateEntitlementGrantSchema,
} from "../schemas/billing.js";
import { recordAdminAuditLog } from "../services/adminAuditLogService.js";
import {
  grantEntitlement,
  listBillingUsers,
  updateEntitlementGrant,
} from "../services/entitlementService.js";

export async function registerAdminBillingRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/billing/users", async (request) => {
    await requireAdminUser(request);
    const query = adminBillingUsersQuerySchema.parse(request.query);
    return listBillingUsers({
      ...(query.q === undefined ? {} : { q: query.q }),
      ...(query.subscriptionStatus === undefined
        ? {}
        : { subscriptionStatus: query.subscriptionStatus }),
      ...(query.entitlementKey === undefined
        ? {}
        : { entitlementKey: query.entitlementKey }),
      limit: query.limit,
    });
  });

  server.post("/v1/admin/entitlements/grant", async (request, reply) => {
    const admin = await requireAdminUser(request);
    const body = grantEntitlementSchema.parse(request.body);
    const grant = await grantEntitlement(body.userId, body.key, body.source, {
      ...(body.expiresAt === undefined
        ? {}
        : { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
      ...(body.notes === undefined ? {} : { notes: body.notes }),
    });
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "CREATE",
      entityType: "EntitlementGrant",
      entityId: grant.id,
      after: grant,
      request,
    });

    void reply.status(201);
    return grant;
  });

  server.patch("/v1/admin/entitlements/:id", async (request) => {
    const admin = await requireAdminUser(request);
    const params = entitlementGrantParamsSchema.parse(request.params);
    const body = updateEntitlementGrantSchema.parse(request.body);
    const before = await prisma.entitlementGrant.findUnique({
      where: { id: params.id },
    });
    if (!before) {
      throw notFound("Entitlement grant not found.");
    }
    const after = await updateEntitlementGrant(params.id, {
      ...(body.active === undefined ? {} : { active: body.active }),
      ...(body.expiresAt === undefined
        ? {}
        : { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
      ...(body.notes === undefined ? {} : { notes: body.notes }),
    });
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "UPDATE",
      entityType: "EntitlementGrant",
      entityId: after.id,
      before,
      after,
      request,
    });
    return after;
  });
}
