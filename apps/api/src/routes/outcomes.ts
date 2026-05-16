import type { FastifyInstance } from "fastify";
import { EntitlementKey } from "@prisma/client";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  outcomeListQuerySchema,
  outcomeParamsSchema,
} from "../schemas/outcomes.js";
import { getOutcome, listOutcomes } from "../services/auditService.js";
import { requireEntitlement } from "../services/entitlementService.js";

export async function registerOutcomeRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/outcomes", async (request) => {
    const user = await resolveCurrentUser(request);
    await requireEntitlement(user.id, EntitlementKey.FULL_TRANSACTION_AUDIT);
    const query = outcomeListQuerySchema.parse(request.query);

    return listOutcomes(user, {
      limit: query.limit,
      outcomeType: query.outcomeType,
      transactionId: query.transactionId,
    });
  });

  server.get("/v1/outcomes/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    await requireEntitlement(user.id, EntitlementKey.FULL_TRANSACTION_AUDIT);
    const params = outcomeParamsSchema.parse(request.params);

    return getOutcome(user, params.id);
  });
}
