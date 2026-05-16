import type { FastifyInstance } from "fastify";

import { createScheduler } from "../services/jobs/scheduler.js";

export async function registerScheduler(
  server: FastifyInstance,
): Promise<void> {
  const scheduler = createScheduler();
  server.addHook("onClose", async () => {
    scheduler.stop();
  });
}
