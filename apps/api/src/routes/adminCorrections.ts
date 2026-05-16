import type { FastifyInstance } from "fastify";

import { prisma } from "@rewards-audit/db";

import { requireAdminUser } from "../plugins/adminGuard.js";
import {
  adminCorrectionListQuerySchema,
  adminCorrectionParamsSchema,
  adminCorrectionUpdateSchema,
} from "../schemas/adminCorrections.js";
import {
  listAdminCorrections,
  updateAdminCorrection,
} from "../services/correctionService.js";
import { recordAdminAuditLog } from "../services/adminAuditLogService.js";

export async function registerAdminCorrectionRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/corrections", async (request) => {
    await requireAdminUser(request);
    const query = adminCorrectionListQuerySchema.parse(request.query);

    return listAdminCorrections({
      status: query.status,
      correctionType: query.correctionType,
      userId: query.userId,
      recommendationEventId: query.recommendationEventId,
      limit: query.limit,
    });
  });

  server.patch("/v1/admin/corrections/:id", async (request) => {
    const admin = await requireAdminUser(request);
    const params = adminCorrectionParamsSchema.parse(request.params);
    const body = adminCorrectionUpdateSchema.parse(request.body);

    const before = await prisma.recommendationCorrection.findUnique({
      where: { id: params.id },
    });
    const after = await updateAdminCorrection(params.id, {
      status: body.status,
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
      entityType: "RecommendationCorrection",
      entityId: params.id,
      before,
      after,
      request,
    });
    return after;
  });
}
