import type { FastifyInstance } from "fastify";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  consentCreateSchema,
  consentParamsSchema,
} from "../schemas/consents.js";
import {
  createConsent,
  listConsents,
  revokeConsent,
} from "../services/consentService.js";

export async function registerConsentRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/consents", async (request) => {
    const user = await resolveCurrentUser(request);
    return listConsents(user);
  });

  server.post("/v1/consents", async (request, reply) => {
    const user = await resolveCurrentUser(request);
    const body = consentCreateSchema.parse(request.body);
    const consent = await createConsent(user, body);
    void reply.status(201);
    return consent;
  });

  server.patch("/v1/consents/:id/revoke", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = consentParamsSchema.parse(request.params);
    return revokeConsent(user, params.id);
  });
}
