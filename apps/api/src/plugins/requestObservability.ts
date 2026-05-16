import type { FastifyInstance, FastifyRequest } from "fastify";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const requestStart = Symbol("requestStart");

type TimedRequest = FastifyRequest & {
  [requestStart]?: bigint;
  currentUser?: { id?: string };
};

export async function registerRequestObservability(
  server: FastifyInstance,
): Promise<void> {
  server.addHook("onRequest", async (request, reply) => {
    (request as TimedRequest)[requestStart] = process.hrtime.bigint();
    reply.header("x-request-id", request.id);
  });

  server.addHook("onResponse", async (request, reply) => {
    const startedAt = (request as TimedRequest)[requestStart];
    const durationMs = startedAt
      ? Number(process.hrtime.bigint() - startedAt) / 1_000_000
      : undefined;
    const statusCode = reply.statusCode;
    if (!shouldLog(statusCode)) {
      return;
    }
    logger.info("Request completed", {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode,
      durationMs:
        durationMs === undefined
          ? undefined
          : Math.round(durationMs * 100) / 100,
      userId: (request as TimedRequest).currentUser?.id,
    });
  });
}

export function sanitizeRequestId(input: unknown): string | undefined {
  const raw = Array.isArray(input) ? input[0] : input;
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function shouldLog(statusCode: number): boolean {
  if (env.LOG_LEVEL === "debug") {
    return true;
  }
  return statusCode >= 400 || env.LOG_LEVEL === "info";
}
