import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { adminEmailLogListQuerySchema } from "../schemas/adminEmailLogs.js";
import { listEmailLogs } from "../services/email/emailService.js";

export async function registerAdminEmailLogRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/email-logs", async (request) => {
    await requireAdminUser(request);
    const query = adminEmailLogListQuerySchema.parse(request.query);
    return listEmailLogs(query);
  });
}
