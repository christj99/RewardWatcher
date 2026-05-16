import type { FastifyInstance } from "fastify";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import { cardParamsSchema, listCardsQuerySchema } from "../schemas/cards.js";

export async function registerCardRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/cards", async (request) => {
    const query = listCardsQuerySchema.parse(request.query);
    const where = {
      ...(query.issuerId ? { issuerId: query.issuerId } : {}),
      ...(query.activeOnly ? { isActive: true } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" as const } },
              { slug: { contains: query.q, mode: "insensitive" as const } },
              {
                issuer: {
                  name: { contains: query.q, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    };

    return prisma.card.findMany({
      where,
      include: {
        issuer: true,
      },
      orderBy: [{ issuer: { name: "asc" } }, { name: "asc" }],
      take: query.limit,
    });
  });

  server.get("/v1/cards/:id", async (request) => {
    const params = cardParamsSchema.parse(request.params);
    const card = await prisma.card.findUnique({
      where: { id: params.id },
      include: {
        issuer: true,
        versions: {
          orderBy: { effectiveFrom: "desc" },
        },
        earningRules: {
          include: {
            rewardCurrency: true,
            merchant: true,
            source: true,
          },
          orderBy: [{ category: "asc" }, { id: "asc" }],
        },
        benefits: {
          include: { source: true },
          orderBy: { name: "asc" },
        },
        statementCredits: {
          include: {
            merchant: true,
            source: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!card) {
      throw notFound("Card was not found.");
    }

    return card;
  });
}
