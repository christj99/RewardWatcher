import type { FastifyInstance } from "fastify";

import { getReadiness } from "../services/observability/systemStatus.js";

export async function registerHealthRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/health", async () => ({
    status: "ok",
  }));

  server.get("/ready", async (_request, reply) => {
    const readiness = await getReadiness();
    return reply
      .status(readiness.status === "ready" ? 200 : 503)
      .send(readiness);
  });
}
