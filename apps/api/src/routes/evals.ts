import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { killTestQuerySchema } from "../schemas/evals.js";
import { getKillTestEvaluation } from "../services/evalsService.js";

export async function registerEvalRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/evals/kill-test", async (request) => {
    await requireAdminUser(request);
    const query = killTestQuerySchema.parse(request.query);

    return getKillTestEvaluation({
      startDate: query.startDate,
      endDate: query.endDate,
      meaningfulMissThresholdCents: query.meaningfulMissThresholdCents,
      annualSubscriptionPriceCents: query.annualSubscriptionPriceCents,
      primaryKillTestUserShare: query.primaryKillTestUserShare,
      maxRecommendationErrorRate: query.maxRecommendationErrorRate,
      maxInconclusiveRate: query.maxInconclusiveRate,
    });
  });
}
