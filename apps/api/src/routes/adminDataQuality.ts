import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import {
  recommendationErrorsQuerySchema,
  ruleFreshnessQuerySchema,
} from "../schemas/adminDataQuality.js";
import {
  getOpenReviewWorkDashboard,
  getRecommendationErrorsDashboard,
  getRuleFreshnessDashboard,
} from "../services/adminDataQualityService.js";

export async function registerAdminDataQualityRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/dashboard/rule-freshness", async (request) => {
    await requireAdminUser(request);
    const query = ruleFreshnessQuerySchema.parse(request.query);
    return getRuleFreshnessDashboard(query);
  });

  server.get("/v1/admin/dashboard/recommendation-errors", async (request) => {
    await requireAdminUser(request);
    const query = recommendationErrorsQuerySchema.parse(request.query);
    return getRecommendationErrorsDashboard(query);
  });

  server.get("/v1/admin/dashboard/open-review-work", async (request) => {
    await requireAdminUser(request);
    return getOpenReviewWorkDashboard();
  });
}
