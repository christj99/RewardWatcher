import type { Prisma } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { badRequest, notFound } from "../lib/httpErrors.js";
import {
  assertCardExists,
  assertDateOrder,
  assertIssuerExists,
  assertUniqueSlug,
  parseNullableDate,
  slugify,
} from "./adminDataHelpers.js";

export async function listAdminCards(input: {
  q?: string | undefined;
  issuerId?: string | undefined;
  isActive?: boolean | undefined;
  limit: number;
}) {
  const where: Prisma.CardWhereInput = {
    ...(input.issuerId ? { issuerId: input.issuerId } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: "insensitive" } },
            { slug: { contains: input.q, mode: "insensitive" } },
            {
              issuer: {
                name: { contains: input.q, mode: "insensitive" },
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
      _count: { select: { versions: true, earningRules: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function createAdminCard(input: {
  issuerId: string;
  name: string;
  slug?: string | undefined;
  network?: Prisma.CardCreateInput["network"] | null | undefined;
  annualFeeCents?: number | null | undefined;
  isActive?: boolean | undefined;
}) {
  await assertIssuerExists(input.issuerId);
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  await assertUniqueSlug({ model: "card", slug });

  return prisma.card.create({
    data: {
      issuerId: input.issuerId,
      name: input.name,
      slug,
      network: input.network ?? null,
      annualFeeCents: input.annualFeeCents ?? null,
      isActive: input.isActive ?? true,
    },
    include: { issuer: true },
  });
}

export async function getAdminCard(id: string) {
  const [card, recentRecommendationCount, recentOutcomeCount] =
    await Promise.all([
      prisma.card.findUnique({
        where: { id },
        include: {
          issuer: true,
          versions: { orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }] },
          earningRules: {
            include: { rewardCurrency: true, merchant: true, source: true },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          },
          benefits: {
            include: { source: true },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          },
          statementCredits: {
            include: { merchant: true, source: true },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          },
        },
      }),
      prisma.recommendationEvent.count({ where: { recommendedCardId: id } }),
      prisma.recommendationOutcome.count({
        where: {
          OR: [
            { actualUserCard: { cardId: id } },
            { bestUserCard: { cardId: id } },
            { recommendedUserCard: { cardId: id } },
          ],
        },
      }),
    ]);

  if (!card) {
    throw notFound("Card was not found.");
  }

  return { ...card, recentRecommendationCount, recentOutcomeCount };
}

export async function updateAdminCard(
  id: string,
  input: {
    name?: string | undefined;
    slug?: string | undefined;
    network?: Prisma.CardUpdateInput["network"] | null | undefined;
    annualFeeCents?: number | null | undefined;
    isActive?: boolean | undefined;
  },
) {
  await assertCardExists(id);
  const slug = input.slug ? slugify(input.slug) : undefined;

  if (slug) {
    await assertUniqueSlug({ model: "card", slug, currentId: id });
  }

  return prisma.card.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(input.network !== undefined ? { network: input.network } : {}),
      ...(input.annualFeeCents !== undefined
        ? { annualFeeCents: input.annualFeeCents }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: { issuer: true, versions: true },
  });
}

export async function listAdminCardVersions(cardId: string) {
  await assertCardExists(cardId);

  return prisma.cardVersion.findMany({
    where: { cardId },
    orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
  });
}

export async function createAdminCardVersion(
  cardId: string,
  input: {
    versionName: string;
    effectiveFrom: string;
    effectiveTo?: string | null | undefined;
    annualFeeCents?: number | null | undefined;
    notes?: string | null | undefined;
  },
) {
  await assertCardExists(cardId);
  assertDateOrder(
    input.effectiveFrom,
    input.effectiveTo,
    "effectiveFrom",
    "effectiveTo",
  );

  return prisma.cardVersion.create({
    data: {
      cardId,
      versionName: input.versionName,
      effectiveFrom: new Date(input.effectiveFrom),
      effectiveTo: parseNullableDate(input.effectiveTo) ?? null,
      annualFeeCents: input.annualFeeCents ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function getAdminCardVersion(id: string) {
  const version = await prisma.cardVersion.findUnique({
    where: { id },
    include: { card: { include: { issuer: true } } },
  });

  if (!version) {
    throw notFound("Card version was not found.");
  }

  return version;
}

export async function updateAdminCardVersion(
  id: string,
  input: {
    versionName?: string | undefined;
    effectiveFrom?: string | undefined;
    effectiveTo?: string | null | undefined;
    annualFeeCents?: number | null | undefined;
    notes?: string | null | undefined;
  },
) {
  const existing = await getAdminCardVersion(id);
  const effectiveFrom =
    input.effectiveFrom ?? existing.effectiveFrom.toISOString();
  const effectiveTo =
    input.effectiveTo === undefined
      ? existing.effectiveTo?.toISOString()
      : input.effectiveTo;

  if (effectiveTo) {
    assertDateOrder(effectiveFrom, effectiveTo, "effectiveFrom", "effectiveTo");
  }

  if (input.effectiveTo === null && input.effectiveFrom) {
    // Valid and explicit open-ended version.
  } else if (
    input.effectiveTo &&
    new Date(input.effectiveTo) <= new Date(effectiveFrom)
  ) {
    throw badRequest("effectiveTo must be after effectiveFrom.");
  }

  const data: Prisma.CardVersionUncheckedUpdateInput = {
    ...(input.versionName !== undefined
      ? { versionName: input.versionName }
      : {}),
    ...(input.effectiveFrom !== undefined
      ? { effectiveFrom: new Date(input.effectiveFrom) }
      : {}),
    ...(input.effectiveTo !== undefined
      ? { effectiveTo: parseNullableDate(input.effectiveTo) ?? null }
      : {}),
    ...(input.annualFeeCents !== undefined
      ? { annualFeeCents: input.annualFeeCents }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };

  return prisma.cardVersion.update({ where: { id }, data });
}
