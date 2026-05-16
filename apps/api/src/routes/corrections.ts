import type { FastifyInstance } from "fastify";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  correctionListQuerySchema,
  correctionParamsSchema,
} from "../schemas/corrections.js";
import {
  getUserCorrection,
  listUserCorrections,
} from "../services/correctionService.js";

export async function registerCorrectionRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/corrections", async (request) => {
    const user = await resolveCurrentUser(request);
    const query = correctionListQuerySchema.parse(request.query);

    return listUserCorrections(user, {
      status: query.status,
      correctionType: query.correctionType,
      limit: query.limit,
    });
  });

  server.get("/v1/corrections/:id", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = correctionParamsSchema.parse(request.params);

    return getUserCorrection(user, params.id);
  });
}
