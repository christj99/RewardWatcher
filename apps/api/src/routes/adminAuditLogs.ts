import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { adminAuditLogListQuerySchema } from "../schemas/adminAuditLogs.js";
import { listAdminAuditLogs } from "../services/adminAuditLogService.js";

export async function registerAdminAuditLogRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/audit-logs", async (request) => {
    const admin = await requireAdminUser(request);
    const query = adminAuditLogListQuerySchema.parse(request.query);
    return listAdminAuditLogs(admin, {
      ...(query.adminUserId ? { adminUserId: query.adminUserId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.startDate ? { startDate: query.startDate } : {}),
      ...(query.endDate ? { endDate: query.endDate } : {}),
      limit: query.limit,
    });
  });
}
