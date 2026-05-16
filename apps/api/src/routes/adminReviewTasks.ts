import type { FastifyInstance } from "fastify";

import { prisma } from "@rewards-audit/db";

import { requireAdminUser } from "../plugins/adminGuard.js";
import {
  adminReviewTaskListQuerySchema,
  adminReviewTaskParamsSchema,
  adminReviewTaskUpdateSchema,
} from "../schemas/adminReviewTasks.js";
import {
  getAdminReviewTask,
  listAdminReviewTasks,
  updateAdminReviewTask,
} from "../services/reviewTaskService.js";
import { recordAdminAuditLog } from "../services/adminAuditLogService.js";

export async function registerAdminReviewTaskRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/review-tasks", async (request) => {
    await requireAdminUser(request);
    const query = adminReviewTaskListQuerySchema.parse(request.query);

    return listAdminReviewTasks({
      status: query.status,
      taskType: query.taskType,
      priority: query.priority,
      correctionId: query.correctionId,
      limit: query.limit,
    });
  });

  server.get("/v1/admin/review-tasks/:id", async (request) => {
    await requireAdminUser(request);
    const params = adminReviewTaskParamsSchema.parse(request.params);

    return getAdminReviewTask(params.id);
  });

  server.patch("/v1/admin/review-tasks/:id", async (request) => {
    const admin = await requireAdminUser(request);
    const params = adminReviewTaskParamsSchema.parse(request.params);
    const body = adminReviewTaskUpdateSchema.parse(request.body);

    const before = await prisma.curatorReviewTask.findUnique({
      where: { id: params.id },
    });
    const after = await updateAdminReviewTask(params.id, {
      status: body.status,
      priority: body.priority,
      resolutionNotes: body.resolutionNotes,
    });
    await recordAdminAuditLog({
      adminUserId: admin.id,
      action:
        body.status === "RESOLVED"
          ? "RESOLVE"
          : body.status === "REJECTED"
            ? "REJECT"
            : "UPDATE",
      entityType: "CuratorReviewTask",
      entityId: params.id,
      before,
      after,
      request,
    });
    return after;
  });
}
