import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { getBetaReadiness } from "../services/betaReadinessService.js";

export async function registerAdminBetaReadinessRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/beta-readiness", async (request) => {
    await requireAdminUser(request);
    return getBetaReadiness();
  });
}
