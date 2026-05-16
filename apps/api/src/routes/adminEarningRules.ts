import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { recordAdminAuditLog } from "../services/adminAuditLogService.js";
import { idParamSchema } from "../schemas/adminShared.js";
import {
  adminEarningRuleCreateSchema,
  adminEarningRuleListQuerySchema,
  adminEarningRuleRetireSchema,
  adminEarningRuleUpdateSchema,
} from "../schemas/adminEarningRules.js";
import {
  createAdminEarningRule,
  getAdminEarningRule,
  listAdminEarningRules,
  retireAdminEarningRule,
  updateAdminEarningRule,
} from "../services/adminEarningRuleService.js";

export async function registerAdminEarningRuleRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/earning-rules", async (request) => {
    await requireAdminUser(request);
    const query = adminEarningRuleListQuerySchema.parse(request.query);
    return listAdminEarningRules(query);
  });

  server.post("/v1/admin/earning-rules", async (request, reply) => {
    const admin = await requireAdminUser(request);
    const body = adminEarningRuleCreateSchema.parse(request.body);
    const rule = await createAdminEarningRule(body);
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "CREATE",
      entityType: "EarningRule",
      entityId: rule.id,
      after: rule,
      request,
    });
    void reply.status(201);
    return rule;
  });

  server.get("/v1/admin/earning-rules/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminEarningRule(params.id);
  });

  server.patch("/v1/admin/earning-rules/:id", async (request) => {
    const admin = await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminEarningRuleUpdateSchema.parse(request.body);
    const before = await getAdminEarningRule(params.id);
    const after = await updateAdminEarningRule(params.id, body);
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "UPDATE",
      entityType: "EarningRule",
      entityId: params.id,
      before,
      after,
      request,
    });
    return after;
  });

  server.post("/v1/admin/earning-rules/:id/retire", async (request) => {
    const admin = await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminEarningRuleRetireSchema.parse(request.body ?? {});
    const before = await getAdminEarningRule(params.id);
    const after = await retireAdminEarningRule(params.id, body);
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action: "RETIRE",
      entityType: "EarningRule",
      entityId: params.id,
      before,
      after,
      request,
    });
    return after;
  });
}
