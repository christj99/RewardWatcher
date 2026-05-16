import type { Prisma } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import {
  assertCurrencyExists,
  assertDateOrder,
  assertRuleSourceExists,
  assertUniqueCurrencyCode,
  parseDecimalInput,
  parseNullableDate,
} from "./adminDataHelpers.js";

export async function listAdminCurrencies(input: {
  q?: string | undefined;
  limit: number;
}) {
  return prisma.currency.findMany({
    where: input.q
      ? {
          OR: [
            { code: { contains: input.q, mode: "insensitive" } },
            { name: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {},
    include: { _count: { select: { valuations: true, earningRules: true } } },
    orderBy: [{ code: "asc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function createAdminCurrency(input: {
  code: string;
  name: string;
  currencyType: Prisma.CurrencyCreateInput["currencyType"];
}) {
  await assertUniqueCurrencyCode(input.code);

  return prisma.currency.create({ data: input });
}

export async function getAdminCurrency(id: string) {
  const currency = await prisma.currency.findUnique({
    where: { id },
    include: {
      valuations: {
        include: { source: true },
        orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
      },
    },
  });

  if (!currency) {
    throw notFound("Currency was not found.");
  }

  return currency;
}

export async function updateAdminCurrency(
  id: string,
  input: {
    code?: string | undefined;
    name?: string | undefined;
    currencyType?: Prisma.CurrencyUpdateInput["currencyType"] | undefined;
  },
) {
  await assertCurrencyExists(id);

  if (input.code) {
    await assertUniqueCurrencyCode(input.code, id);
  }

  const data: Prisma.CurrencyUncheckedUpdateInput = {
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.currencyType !== undefined
      ? { currencyType: input.currencyType }
      : {}),
  };

  return prisma.currency.update({ where: { id }, data });
}

export async function listAdminCurrencyValuations(currencyId: string) {
  await assertCurrencyExists(currencyId);

  return prisma.currencyValuation.findMany({
    where: { currencyId },
    include: { source: true },
    orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
  });
}

export async function createAdminCurrencyValuation(
  currencyId: string,
  input: {
    lens: Prisma.CurrencyValuationCreateInput["lens"];
    centsPerPoint: string | number;
    confidence: Prisma.CurrencyValuationCreateInput["confidence"];
    sourceId?: string | null | undefined;
    effectiveFrom: string;
    effectiveTo?: string | null | undefined;
    notes?: string | null | undefined;
  },
) {
  await assertCurrencyExists(currencyId);
  await assertRuleSourceExists(input.sourceId);
  assertDateOrder(
    input.effectiveFrom,
    input.effectiveTo,
    "effectiveFrom",
    "effectiveTo",
  );

  const data: Prisma.CurrencyValuationUncheckedCreateInput = {
    currencyId,
    lens: input.lens,
    centsPerPoint: parseDecimalInput(input.centsPerPoint, "centsPerPoint"),
    confidence: input.confidence,
    sourceId: input.sourceId ?? null,
    effectiveFrom: new Date(input.effectiveFrom),
    effectiveTo: parseNullableDate(input.effectiveTo) ?? null,
    notes: input.notes ?? null,
  };

  return prisma.currencyValuation.create({
    data,
    include: { currency: true, source: true },
  });
}

export async function getAdminCurrencyValuation(id: string) {
  const valuation = await prisma.currencyValuation.findUnique({
    where: { id },
    include: { currency: true, source: true },
  });

  if (!valuation) {
    throw notFound("Currency valuation was not found.");
  }

  return valuation;
}

export async function updateAdminCurrencyValuation(
  id: string,
  input: CurrencyValuationUpdateInput,
) {
  const existing = await getAdminCurrencyValuation(id);
  await assertRuleSourceExists(input.sourceId);

  const effectiveFrom =
    input.effectiveFrom ?? existing.effectiveFrom.toISOString();
  const effectiveTo =
    input.effectiveTo === undefined
      ? existing.effectiveTo?.toISOString()
      : input.effectiveTo;
  assertDateOrder(effectiveFrom, effectiveTo, "effectiveFrom", "effectiveTo");

  const data: Prisma.CurrencyValuationUncheckedUpdateInput = {
    ...(input.lens !== undefined ? { lens: input.lens } : {}),
    ...(input.centsPerPoint !== undefined
      ? {
          centsPerPoint: parseDecimalInput(
            input.centsPerPoint,
            "centsPerPoint",
          ),
        }
      : {}),
    ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
    ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
    ...(input.effectiveFrom !== undefined
      ? { effectiveFrom: new Date(input.effectiveFrom) }
      : {}),
    ...(input.effectiveTo !== undefined
      ? { effectiveTo: parseNullableDate(input.effectiveTo) ?? null }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };

  return prisma.currencyValuation.update({ where: { id }, data });
}

type CurrencyValuationInput = Parameters<
  typeof createAdminCurrencyValuation
>[1];

type CurrencyValuationUpdateInput = {
  [K in keyof CurrencyValuationInput]?: CurrencyValuationInput[K] | undefined;
};
