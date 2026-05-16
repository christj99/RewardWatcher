import type { FastifyInstance } from "fastify";

import { prisma } from "./testUtils.js";

export const adminHeaders = { "x-user-email": "admin@example.com" };
export const betaHeaders = { "x-user-email": "beta@example.com" };

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function createAdminIssuer(
  server: FastifyInstance,
  prefix = "admin-test-issuer",
) {
  const slug = uniqueSlug(prefix);
  const response = await server.inject({
    method: "POST",
    url: "/v1/admin/issuers",
    headers: adminHeaders,
    payload: {
      name: `Admin Test Issuer ${slug}`,
      slug,
      websiteUrl: "https://example.com",
    },
  });

  return response.json() as { id: string; slug: string };
}

export async function createAdminCard(server: FastifyInstance) {
  const issuer = await createAdminIssuer(server, "admin-card-issuer");
  const slug = uniqueSlug("admin-card");
  const response = await server.inject({
    method: "POST",
    url: "/v1/admin/cards",
    headers: adminHeaders,
    payload: {
      issuerId: issuer.id,
      name: `Admin Test Card ${slug}`,
      slug,
      network: "VISA",
      annualFeeCents: 9500,
    },
  });

  return response.json() as { id: string; slug: string; issuerId: string };
}

export async function createAdminRuleSource(server: FastifyInstance) {
  const title = `Admin Test Source ${uniqueSlug("source")}`;
  const response = await server.inject({
    method: "POST",
    url: "/v1/admin/rule-sources",
    headers: adminHeaders,
    payload: {
      sourceType: "CURATOR_RESEARCH",
      title,
      url: "https://example.com/source",
      verifiedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "test",
    },
  });

  return response.json() as { id: string };
}

export async function seededCurrency() {
  return prisma.currency.findUniqueOrThrow({ where: { code: "CHASE_UR" } });
}

export async function seededMerchant(slug = "starbucks") {
  return prisma.merchant.findUniqueOrThrow({ where: { slug } });
}
