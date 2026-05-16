import type { Prisma } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import { assertUniqueSlug, slugify } from "./adminDataHelpers.js";

export async function listAdminIssuers(input: {
  q?: string | undefined;
  limit: number;
}) {
  const where: Prisma.IssuerWhereInput = input.q
    ? {
        OR: [
          { name: { contains: input.q, mode: "insensitive" } },
          { slug: { contains: input.q, mode: "insensitive" } },
        ],
      }
    : {};

  return prisma.issuer.findMany({
    where,
    include: { _count: { select: { cards: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function createAdminIssuer(input: {
  name: string;
  slug?: string | undefined;
  websiteUrl?: string | null | undefined;
}) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  await assertUniqueSlug({ model: "issuer", slug });

  return prisma.issuer.create({
    data: {
      name: input.name,
      slug,
      websiteUrl: input.websiteUrl ?? null,
    },
  });
}

export async function getAdminIssuer(id: string) {
  const issuer = await prisma.issuer.findUnique({
    where: { id },
    include: { cards: { orderBy: [{ name: "asc" }, { id: "asc" }] } },
  });

  if (!issuer) {
    throw notFound("Issuer was not found.");
  }

  return issuer;
}

export async function updateAdminIssuer(
  id: string,
  input: {
    name?: string | undefined;
    slug?: string | undefined;
    websiteUrl?: string | null | undefined;
  },
) {
  await getAdminIssuer(id);
  const slug = input.slug ? slugify(input.slug) : undefined;

  if (slug) {
    await assertUniqueSlug({ model: "issuer", slug, currentId: id });
  }

  return prisma.issuer.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(input.websiteUrl !== undefined
        ? { websiteUrl: input.websiteUrl }
        : {}),
    },
  });
}
