import type { FastifyInstance } from "fastify";
import { BetaEventSource, BetaEventType, EntitlementKey } from "@prisma/client";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  disconnectPlaidSchema,
  exchangePublicTokenSchema,
  linkPlaidAccountSchema,
  plaidAccountParamsSchema,
  plaidConnectionParamsSchema,
  plaidSyncSchema,
} from "../schemas/plaid.js";
import {
  createPlaidLinkToken,
  deletePlaidData,
  disconnectPlaidConnection,
  exchangePlaidPublicToken,
  getPlaidStatus,
  handlePlaidWebhook,
  linkPlaidAccountToUserCard,
  syncAllPlaidConnections,
  syncPlaidConnection,
} from "../services/plaidService.js";
import { requireConsent } from "../services/consentService.js";
import { requireEntitlement } from "../services/entitlementService.js";
import { recordBetaEvent } from "../services/betaEventService.js";

export async function registerPlaidRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.post("/v1/plaid/link-token", async (request) => {
    const user = await resolveCurrentUser(request);
    await requireEntitlement(user.id, EntitlementKey.PLAID_SYNC);
    await requireConsent(user.id, "PLAID_TRANSACTIONS");
    return createPlaidLinkToken(user);
  });

  server.post("/v1/plaid/exchange-public-token", async (request) => {
    const user = await resolveCurrentUser(request);
    await requireEntitlement(user.id, EntitlementKey.PLAID_SYNC);
    await requireConsent(user.id, "PLAID_TRANSACTIONS");
    const body = exchangePublicTokenSchema.parse(request.body);
    const result = await exchangePlaidPublicToken(
      user,
      body.publicToken,
      body.metadata,
    );
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.PLAID_CONNECTED,
      source: BetaEventSource.API,
      metadata: {
        connectionId: result.connection.id,
        accountCount: result.accounts.length,
      },
    });
    return result;
  });

  server.get("/v1/plaid/status", async (request) => {
    const user = await resolveCurrentUser(request);
    return getPlaidStatus(user);
  });

  server.patch("/v1/plaid/accounts/:id/link-card", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = plaidAccountParamsSchema.parse(request.params);
    const body = linkPlaidAccountSchema.parse(request.body);
    return linkPlaidAccountToUserCard(user, params.id, body.userCardId);
  });

  server.post("/v1/plaid/connections/:id/sync", async (request) => {
    const user = await resolveCurrentUser(request);
    await requireEntitlement(user.id, EntitlementKey.PLAID_SYNC);
    const params = plaidConnectionParamsSchema.parse(request.params);
    const body = plaidSyncSchema.parse(request.body ?? {});
    const run = await syncPlaidConnection(user, params.id, body);
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.PLAID_SYNC_COMPLETED,
      source: BetaEventSource.API,
      metadata: {
        connectionId: params.id,
        syncRunId: run.id,
        status: run.status,
        importedTransactionCount: run.importedTransactionCount,
      },
    });

    return {
      syncRunId: run.id,
      addedCount: run.addedCount,
      modifiedCount: run.modifiedCount,
      removedCount: run.removedCount,
      importedTransactionCount: run.importedTransactionCount,
      auditedTransactionCount: run.auditedTransactionCount,
      status: run.status,
    };
  });

  server.post("/v1/plaid/sync", async (request) => {
    const user = await resolveCurrentUser(request);
    await requireEntitlement(user.id, EntitlementKey.PLAID_SYNC);
    const body = plaidSyncSchema.parse(request.body ?? {});
    const result = await syncAllPlaidConnections(user, body);
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.PLAID_SYNC_COMPLETED,
      source: BetaEventSource.API,
      metadata: result,
    });
    return result;
  });

  server.delete("/v1/plaid/connections/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = plaidConnectionParamsSchema.parse(request.params);
    const body = disconnectPlaidSchema.parse(request.body ?? {});
    return disconnectPlaidConnection(user, params.id, body);
  });

  server.delete("/v1/plaid/data", async (request) => {
    const user = await resolveCurrentUser(request);
    return deletePlaidData(user);
  });

  server.post("/v1/plaid/webhook", async (request) =>
    handlePlaidWebhook(request.body),
  );
}
