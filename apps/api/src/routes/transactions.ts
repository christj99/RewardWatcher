import type { FastifyInstance } from "fastify";
import { BetaEventSource, BetaEventType, EntitlementKey } from "@prisma/client";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  importTransactionsSchema,
  transactionListQuerySchema,
  transactionParamsSchema,
} from "../schemas/transactions.js";
import { auditTransaction } from "../services/auditService.js";
import {
  getTransaction,
  importTransactions,
  listTransactions,
} from "../services/transactionService.js";
import { requireEntitlement } from "../services/entitlementService.js";
import { recordBetaEvent } from "../services/betaEventService.js";

export async function registerTransactionRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.post("/v1/transactions/import", async (request, reply) => {
    const user = await resolveCurrentUser(request);
    const body = importTransactionsSchema.parse(request.body);
    if (body.audit) {
      await requireEntitlement(user.id, EntitlementKey.FULL_TRANSACTION_AUDIT);
    }
    const result = await importTransactions(user, body);
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.TRANSACTION_IMPORTED,
      source: BetaEventSource.API,
      metadata: {
        source: body.source,
        requestedCount: body.transactions.length,
        createdCount: result.createdCount,
        existingCount: result.existingCount,
        auditedCount: result.auditedCount,
      },
    });

    void reply.status(201);
    return result;
  });

  server.get("/v1/transactions", async (request) => {
    const user = await resolveCurrentUser(request);
    const query = transactionListQuerySchema.parse(request.query);

    return listTransactions(user, {
      limit: query.limit,
      source: query.source,
      merchantId: query.merchantId,
      userCardId: query.userCardId,
    });
  });

  server.get("/v1/transactions/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = transactionParamsSchema.parse(request.params);

    return getTransaction(user, params.id);
  });

  server.post("/v1/transactions/:id/audit", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = transactionParamsSchema.parse(request.params);
    await requireEntitlement(user.id, EntitlementKey.FULL_TRANSACTION_AUDIT);

    const outcome = await auditTransaction(user, params.id);
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.TRANSACTION_AUDITED,
      source: BetaEventSource.API,
      metadata: {
        transactionId: params.id,
        outcomeId: outcome.id,
        outcomeType: outcome.outcomeType,
      },
    });
    return outcome;
  });
}
