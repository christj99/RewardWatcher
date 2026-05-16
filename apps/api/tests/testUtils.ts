import { prisma, seedDatabase } from "@rewards-audit/db";
import type { FastifyInstance } from "fastify";

import { buildServer } from "../src/server.js";

export async function buildSeededServer(): Promise<FastifyInstance> {
  await seedDatabase();
  return buildServer();
}

export { prisma };
