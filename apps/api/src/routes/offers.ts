import type { FastifyInstance } from "fastify";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import { idParamSchema } from "../schemas/adminShared.js";
import {
  offerActivationSchema,
  offerListQuerySchema,
} from "../schemas/offers.js";
import {
  getUserOffer,
  listUserOffers,
  updateUserOfferActivation,
} from "../services/offerService.js";

export async function registerOfferRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/offers", async (request) => {
    const user = await resolveCurrentUser(request);
    const query = offerListQuerySchema.parse(request.query);
    return listUserOffers(user, query);
  });

  server.get("/v1/offers/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = idParamSchema.parse(request.params);
    return getUserOffer(user, params.id);
  });

  server.patch("/v1/offers/:id/activation", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = idParamSchema.parse(request.params);
    const body = offerActivationSchema.parse(request.body);
    return updateUserOfferActivation(user, params.id, body);
  });
}
