import type { Prisma } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import { parseNullableDate } from "./adminDataHelpers.js";

export async function listAdminRuleSources(input: {
  q?: string | undefined;
  sourceType?: Prisma.RuleSourceWhereInput["sourceType"] | undefined;
  staleOnly?: boolean | undefined;
  limit: number;
}) {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - 180);
  const where: Prisma.RuleSourceWhereInput = {
    ...(input.sourceType ? { sourceType: input.sourceType } : {}),
    ...(input.q
      ? {
          OR: [
            { title: { contains: input.q, mode: "insensitive" } },
            { url: { contains: input.q, mode: "insensitive" } },
            { notes: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(input.staleOnly
      ? {
          OR: [{ verifiedAt: null }, { verifiedAt: { lt: staleDate } }],
        }
      : {}),
  };

  return prisma.ruleSource.findMany({
    where,
    include: { _count: { select: { earningRules: true } } },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function createAdminRuleSource(input: {
  sourceType: Prisma.RuleSourceCreateInput["sourceType"];
  title: string;
  url?: string | null | undefined;
  retrievedAt?: string | null | undefined;
  verifiedAt?: string | null | undefined;
  notes?: string | null | undefined;
  createdBy?: string | null | undefined;
}) {
  const data: Prisma.RuleSourceUncheckedCreateInput = {
    sourceType: input.sourceType,
    title: input.title,
    url: input.url ?? null,
    retrievedAt: parseNullableDate(input.retrievedAt) ?? null,
    verifiedAt: parseNullableDate(input.verifiedAt) ?? null,
    notes: input.notes ?? null,
    createdBy: input.createdBy ?? null,
  };

  return prisma.ruleSource.create({ data });
}

export async function getAdminRuleSource(id: string) {
  const source = await prisma.ruleSource.findUnique({
    where: { id },
    include: {
      earningRules: { take: 25, orderBy: [{ createdAt: "desc" }] },
      currencyValuations: { take: 25, orderBy: [{ effectiveFrom: "desc" }] },
    },
  });

  if (!source) {
    throw notFound("Rule source was not found.");
  }

  return source;
}

export async function updateAdminRuleSource(
  id: string,
  input: RuleSourceUpdateInput,
) {
  await getAdminRuleSource(id);

  const data: Prisma.RuleSourceUncheckedUpdateInput = {
    ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.url !== undefined ? { url: input.url } : {}),
    ...(input.retrievedAt !== undefined
      ? { retrievedAt: parseNullableDate(input.retrievedAt) ?? null }
      : {}),
    ...(input.verifiedAt !== undefined
      ? { verifiedAt: parseNullableDate(input.verifiedAt) ?? null }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.createdBy !== undefined ? { createdBy: input.createdBy } : {}),
  };

  return prisma.ruleSource.update({ where: { id }, data });
}

type RuleSourceInput = Parameters<typeof createAdminRuleSource>[0];

type RuleSourceUpdateInput = {
  [K in keyof RuleSourceInput]?: RuleSourceInput[K] | undefined;
};
