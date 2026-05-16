import type { FastifyInstance } from "fastify";
import { BetaEventSource, BetaEventType } from "@prisma/client";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  deleteAccountSchema,
  deletePlaidDataSchema,
  deleteTransactionsSchema,
} from "../schemas/privacy.js";
import {
  createExportRequest,
  deleteUserAccount,
  deleteUserPlaidData,
  deleteUserTransactions,
  listPrivacyRequests,
} from "../services/privacyService.js";
import { recordBetaEvent } from "../services/betaEventService.js";

export async function registerPrivacyRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/privacy/requests", async (request) => {
    const user = await resolveCurrentUser(request);
    return listPrivacyRequests(user);
  });

  server.delete("/v1/privacy/plaid-data", async (request) => {
    const user = await resolveCurrentUser(request);
    deletePlaidDataSchema.parse(request.body);
    const result = await deleteUserPlaidData(user);
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.PRIVACY_DELETION_REQUESTED,
      source: BetaEventSource.API,
      metadata: {
        requestType: "DELETE_PLAID_DATA",
        privacyRequestId: result.id,
      },
    });
    return result;
  });

  server.delete("/v1/privacy/transactions", async (request) => {
    const user = await resolveCurrentUser(request);
    const body = deleteTransactionsSchema.parse(request.body);
    const result = await deleteUserTransactions(user, body.source);
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.PRIVACY_DELETION_REQUESTED,
      source: BetaEventSource.API,
      metadata: {
        requestType: "DELETE_TRANSACTIONS",
        source: body.source,
        privacyRequestId: result.id,
      },
    });
    return result;
  });

  server.delete("/v1/privacy/account", async (request) => {
    const user = await resolveCurrentUser(request);
    deleteAccountSchema.parse(request.body);
    const result = await deleteUserAccount(user);
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.PRIVACY_DELETION_REQUESTED,
      source: BetaEventSource.API,
      metadata: { requestType: "DELETE_ACCOUNT", privacyRequestId: result.id },
    });
    return result;
  });

  server.post("/v1/privacy/export", async (request) => {
    const user = await resolveCurrentUser(request);
    return createExportRequest(user);
  });
}
