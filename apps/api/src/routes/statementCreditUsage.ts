import type { FastifyInstance } from "fastify";
import { EntitlementKey } from "@prisma/client";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  generateStatementCreditUsageSchema,
  listStatementCreditUsageQuerySchema,
  statementCreditUsageParamsSchema,
  updateStatementCreditUsageSchema,
} from "../schemas/statementCreditUsage.js";
import {
  generateStatementCreditUsage,
  listStatementCreditUsage,
  updateStatementCreditUsage,
} from "../services/statementCreditUsageService.js";
import { requireEntitlement } from "../services/entitlementService.js";

export async function registerStatementCreditUsageRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/statement-credit-usage", async (request) => {
    const user = await resolveCurrentUser(request);
    await requireEntitlement(user.id, EntitlementKey.STATEMENT_CREDIT_TRACKING);
    const query = listStatementCreditUsageQuerySchema.parse(request.query);
    return listStatementCreditUsage(user, query);
  });

  server.patch("/v1/statement-credit-usage/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    await requireEntitlement(user.id, EntitlementKey.STATEMENT_CREDIT_TRACKING);
    const params = statementCreditUsageParamsSchema.parse(request.params);
    const body = updateStatementCreditUsageSchema.parse(request.body);
    return updateStatementCreditUsage(user, params.id, body);
  });

  server.post("/v1/statement-credit-usage/generate", async (request) => {
    const user = await resolveCurrentUser(request);
    await requireEntitlement(user.id, EntitlementKey.STATEMENT_CREDIT_TRACKING);
    const body = generateStatementCreditUsageSchema.parse(request.body ?? {});
    return generateStatementCreditUsage(user, body);
  });
}
