import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import {
  getDiagnostics,
  getOpsSummary,
} from "../services/observability/systemStatus.js";

export async function registerAdminOpsRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/diagnostics", async (request) => {
    await requireAdminUser(request);
    return getDiagnostics();
  });

  server.get("/v1/admin/ops/summary", async (request) => {
    await requireAdminUser(request);
    return getOpsSummary();
  });
}
