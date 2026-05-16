import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import {
  adminJobRunParamsSchema,
  adminJobRunsQuerySchema,
  adminRunJobSchema,
} from "../schemas/adminJobs.js";
import {
  getAdminJobRun,
  getAdminJobStatus,
  listAdminJobRuns,
  runAdminJob,
} from "../services/adminJobService.js";

export async function registerAdminJobRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/jobs/runs", async (request) => {
    await requireAdminUser(request);
    const query = adminJobRunsQuerySchema.parse(request.query);
    return listAdminJobRuns(query);
  });

  server.get("/v1/admin/jobs/runs/:id", async (request) => {
    await requireAdminUser(request);
    const params = adminJobRunParamsSchema.parse(request.params);
    return getAdminJobRun(params.id);
  });

  server.get("/v1/admin/jobs/status", async (request) => {
    await requireAdminUser(request);
    return getAdminJobStatus();
  });

  server.post("/v1/admin/jobs/run", async (request) => {
    const admin = await requireAdminUser(request);
    const body = adminRunJobSchema.parse(request.body);
    return runAdminJob(admin, request, body);
  });
}
