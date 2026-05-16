import type { FastifyInstance } from "fastify";
import { BetaEventSource, BetaEventType, EntitlementKey } from "@prisma/client";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  createRecommendationSchema,
  recommendationHistoryQuerySchema,
  recommendationParamsSchema,
} from "../schemas/recommendations.js";
import { createCorrectionSchema } from "../schemas/corrections.js";
import { createRecommendationCorrection } from "../services/correctionService.js";
import {
  createRecommendation,
  getRecommendationReceipt,
  listRecommendationHistory,
} from "../services/recommendationService.js";
import { requireEntitlement } from "../services/entitlementService.js";
import { recordBetaEvent } from "../services/betaEventService.js";

export async function registerRecommendationRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.post("/v1/recommendations", async (request, reply) => {
    const user = await resolveCurrentUser(request);
    const body = createRecommendationSchema.parse(request.body);
    if (body.lens === "ASPIRATIONAL") {
      await requireEntitlement(user.id, EntitlementKey.ADVANCED_LENSES);
    }
    const receipt = await createRecommendation(user, body);
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.RECOMMENDATION_CREATED,
      source: BetaEventSource.API,
      metadata: {
        recommendationEventId: receipt.id,
        merchantId: receipt.merchant?.id,
        context: body.context,
      },
    });
    if (body.context === "ONLINE_CHECKOUT") {
      void recordBetaEvent({
        userId: user.id,
        eventType: BetaEventType.CHECKOUT_EXTENSION_RECOMMENDATION_SHOWN,
        source: BetaEventSource.EXTENSION,
        metadata: {
          recommendationEventId: receipt.id,
          merchantId: receipt.merchant?.id,
        },
      });
    }

    void reply.status(201);
    return receipt;
  });

  server.post("/v1/recommendations/:id/correction", async (request, reply) => {
    const user = await resolveCurrentUser(request);
    const params = recommendationParamsSchema.parse(request.params);
    const body = createCorrectionSchema.parse(request.body);
    const result = await createRecommendationCorrection(user, params.id, body);
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.CORRECTION_SUBMITTED,
      source: BetaEventSource.API,
      metadata: {
        recommendationEventId: params.id,
        correctionType: body.correctionType,
      },
    });

    void reply.status(201);
    return result;
  });

  server.get("/v1/recommendations/history", async (request) => {
    const user = await resolveCurrentUser(request);
    const query = recommendationHistoryQuerySchema.parse(request.query);
    return listRecommendationHistory(user, {
      limit: query.limit,
      merchantId: query.merchantId,
    });
  });

  server.get("/v1/recommendations/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = recommendationParamsSchema.parse(request.params);
    return getRecommendationReceipt(user, params.id);
  });
}
