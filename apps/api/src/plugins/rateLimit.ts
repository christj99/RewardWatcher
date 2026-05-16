import type { FastifyInstance, FastifyRequest } from "fastify";

import { HttpError } from "../lib/httpErrors.js";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const sensitiveRoutePatterns = [
  /^POST \/v1\/recommendations$/,
  /^POST \/v1\/auth\/register$/,
  /^POST \/v1\/auth\/login$/,
  /^POST \/v1\/auth\/password-reset\/request$/,
  /^POST \/v1\/auth\/password-reset\/confirm$/,
  /^POST \/v1\/auth\/extension-token$/,
  /^POST \/v1\/auth\/extension-session$/,
  /^POST \/v1\/transactions\/import$/,
  /^POST \/v1\/transactions\/[^/]+\/audit$/,
  /^POST \/v1\/plaid\/link-token$/,
  /^POST \/v1\/plaid\/exchange-public-token$/,
  /^POST \/v1\/plaid\/sync$/,
  /^POST \/v1\/plaid\/connections\/[^/]+\/sync$/,
  /^POST \/v1\/billing\/create-checkout-session$/,
  /^POST \/v1\/billing\/create-portal-session$/,
  /^POST \/v1\/reminders\/generate-defaults$/,
  /^POST \/v1\/statement-credit-usage\/generate$/,
  /^PATCH \/v1\/offers\/[^/]+\/activation$/,
  /^POST \/v1\/recommendations\/[^/]+\/correction$/,
];

export async function registerRateLimit(
  server: FastifyInstance,
): Promise<void> {
  server.addHook("preHandler", async (request) => {
    if (!isRateLimitEnabled()) {
      return;
    }
    if (!shouldLimit(request)) {
      return;
    }

    const windowMs = readPositiveInt("RATE_LIMIT_WINDOW_MS", 60_000);
    const max = routeLimit(request);
    const now = Date.now();
    const key = `${request.method}:${routeKey(request)}:${userOrIpKey(request)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      throw new HttpError(
        429,
        "Too many requests. Please wait before trying again.",
        "RATE_LIMITED",
      );
    }
  });
}

export function resetRateLimitBucketsForTests(): void {
  buckets.clear();
}

function shouldLimit(request: FastifyRequest): boolean {
  const route = routeKey(request);
  const methodAndRoute = `${request.method} ${route}`;
  return (
    sensitiveRoutePatterns.some((pattern) => pattern.test(methodAndRoute)) ||
    (route.startsWith("/v1/admin/") && request.method !== "GET")
  );
}

function routeLimit(request: FastifyRequest): number {
  const route = routeKey(request);
  if (route.startsWith("/v1/plaid/")) {
    return readPositiveInt("RATE_LIMIT_PLAID_MAX", 10);
  }
  if (route.startsWith("/v1/billing/")) {
    return readPositiveInt("RATE_LIMIT_BILLING_MAX", 20);
  }
  return readPositiveInt("RATE_LIMIT_MAX", 120);
}

function routeKey(request: FastifyRequest): string {
  return request.routeOptions.url ?? request.url.split("?")[0] ?? request.url;
}

function userOrIpKey(request: FastifyRequest): string {
  const userEmail = request.headers["x-user-email"];
  const email = Array.isArray(userEmail) ? userEmail[0] : userEmail;
  return email ? `user:${email}` : `ip:${request.ip}`;
}

function isRateLimitEnabled(): boolean {
  if (process.env.RATE_LIMIT_ENABLED === undefined) {
    return process.env.NODE_ENV !== "test";
  }
  return process.env.RATE_LIMIT_ENABLED.toLowerCase() !== "false";
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
