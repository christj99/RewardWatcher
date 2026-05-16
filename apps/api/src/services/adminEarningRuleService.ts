import type { CapPeriod, MerchantCategory, Prisma } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { badRequest, notFound } from "../lib/httpErrors.js";
import {
  assertCardExists,
  assertCardVersionBelongsToCard,
  assertCurrencyExists,
  assertDateOrder,
  assertMerchantExists,
  assertRuleSourceExists,
  parseDecimalInput,
  parseNullableDate,
} from "./adminDataHelpers.js";

type EarningRuleInput = {
  cardId: string;
  cardVersionId?: string | null | undefined;
  rewardCurrencyId: string;
  category?: MerchantCategory | null | undefined;
  merchantId?: string | null | undefined;
  multiplier: string | number;
  baseRateMultiplier?: string | number | null | undefined;
  capAmountCents?: number | null | undefined;
  capPeriod?: CapPeriod | null | undefined;
  activationRequired?: boolean | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
  confidence: Prisma.EarningRuleCreateInput["confidence"];
  sourceId?: string | null | undefined;
  notes?: string | null | undefined;
  isBaseRule?: boolean | undefined;
};

type EarningRuleUpdateInput = {
  [K in keyof EarningRuleInput]?: EarningRuleInput[K] | undefined;
};

export async function listAdminEarningRules(input: {
  cardId?: string | undefined;
  merchantId?: string | undefined;
  category?: MerchantCategory | undefined;
  confidence?: Prisma.EarningRuleWhereInput["confidence"] | undefined;
  activeAt?: string | undefined;
  sourceId?: string | undefined;
  limit: number;
}) {
  const activeAt = input.activeAt ? new Date(input.activeAt) : null;
  const where: Prisma.EarningRuleWhereInput = {
    ...(input.cardId ? { cardId: input.cardId } : {}),
    ...(input.merchantId ? { merchantId: input.merchantId } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.confidence ? { confidence: input.confidence } : {}),
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(activeAt
      ? {
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: activeAt } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: activeAt } }] },
          ],
        }
      : {}),
  };

  return prisma.earningRule.findMany({
    where,
    include: {
      card: { include: { issuer: true } },
      rewardCurrency: true,
      merchant: true,
      source: true,
      cardVersion: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function createAdminEarningRule(input: EarningRuleInput) {
  await validateEarningRuleRelations(input);

  return prisma.earningRule.create({
    data: mapEarningRuleData(input),
    include: {
      card: { include: { issuer: true } },
      rewardCurrency: true,
      merchant: true,
      source: true,
      cardVersion: true,
    },
  });
}

export async function getAdminEarningRule(id: string) {
  const rule = await prisma.earningRule.findUnique({
    where: { id },
    include: {
      card: { include: { issuer: true } },
      rewardCurrency: true,
      merchant: true,
      source: true,
      cardVersion: true,
      capLedgers: { take: 10 },
    },
  });

  if (!rule) {
    throw notFound("Earning rule was not found.");
  }

  return rule;
}

export async function updateAdminEarningRule(
  id: string,
  input: EarningRuleUpdateInput,
) {
  const existing = await getAdminEarningRule(id);
  const merged: EarningRuleInput = {
    cardId: input.cardId ?? existing.cardId,
    cardVersionId:
      input.cardVersionId === undefined
        ? existing.cardVersionId
        : input.cardVersionId,
    rewardCurrencyId: input.rewardCurrencyId ?? existing.rewardCurrencyId,
    category: input.category === undefined ? existing.category : input.category,
    merchantId:
      input.merchantId === undefined ? existing.merchantId : input.merchantId,
    multiplier:
      input.multiplier === undefined
        ? existing.multiplier.toString()
        : input.multiplier,
    baseRateMultiplier:
      input.baseRateMultiplier === undefined
        ? existing.baseRateMultiplier?.toString()
        : input.baseRateMultiplier,
    capAmountCents:
      input.capAmountCents === undefined
        ? existing.capAmountCents
        : input.capAmountCents,
    capPeriod:
      input.capPeriod === undefined ? existing.capPeriod : input.capPeriod,
    activationRequired: input.activationRequired ?? existing.activationRequired,
    startsAt:
      input.startsAt === undefined
        ? existing.startsAt?.toISOString()
        : input.startsAt,
    endsAt:
      input.endsAt === undefined
        ? existing.endsAt?.toISOString()
        : input.endsAt,
    confidence: input.confidence ?? existing.confidence,
    sourceId: input.sourceId === undefined ? existing.sourceId : input.sourceId,
    notes: input.notes === undefined ? existing.notes : input.notes,
    isBaseRule: input.isBaseRule,
  };
  validateEarningRuleShape(merged);
  await validateEarningRuleRelations(merged);

  return prisma.earningRule.update({
    where: { id },
    data: mapEarningRuleData(merged),
    include: {
      card: { include: { issuer: true } },
      rewardCurrency: true,
      merchant: true,
      source: true,
      cardVersion: true,
    },
  });
}

export async function retireAdminEarningRule(
  id: string,
  input: { endsAt?: string | undefined; notes?: string | undefined },
) {
  const rule = await getAdminEarningRule(id);
  const endsAt = input.endsAt ? new Date(input.endsAt) : new Date();
  const notes = [rule.notes, input.notes ?? "Retired by admin operation."]
    .filter(Boolean)
    .join("\n");

  return prisma.earningRule.update({
    where: { id },
    data: { endsAt, notes },
  });
}

async function validateEarningRuleRelations(input: EarningRuleInput) {
  await Promise.all([
    assertCardExists(input.cardId),
    assertCurrencyExists(input.rewardCurrencyId),
    input.merchantId
      ? assertMerchantExists(input.merchantId)
      : Promise.resolve(),
    assertRuleSourceExists(input.sourceId),
  ]);
  await assertCardVersionBelongsToCard(input.cardVersionId, input.cardId);
}

function validateEarningRuleShape(input: EarningRuleInput): void {
  if (
    input.capAmountCents !== null &&
    input.capAmountCents !== undefined &&
    !input.capPeriod
  ) {
    throw badRequest("capPeriod is required when capAmountCents is provided.");
  }
  if (
    input.capPeriod &&
    (input.capAmountCents === null || input.capAmountCents === undefined)
  ) {
    throw badRequest("capAmountCents is required when capPeriod is provided.");
  }
  if (input.startsAt && input.endsAt) {
    assertDateOrder(input.startsAt, input.endsAt);
  }
  if (!input.category && !input.merchantId) {
    const isExplicitBase =
      input.isBaseRule === true || input.notes?.toLowerCase().includes("base");
    if (!isExplicitBase) {
      throw badRequest(
        "Base/everywhere rules require isBaseRule=true or notes mentioning base.",
      );
    }
  }
  if (!input.sourceId && !input.notes) {
    throw badRequest(
      "notes must explain the source gap when sourceId is omitted.",
    );
  }
}

function mapEarningRuleData(input: EarningRuleInput) {
  return {
    cardId: input.cardId,
    cardVersionId: input.cardVersionId ?? null,
    rewardCurrencyId: input.rewardCurrencyId,
    category: input.category ?? null,
    merchantId: input.merchantId ?? null,
    multiplier: parseDecimalInput(input.multiplier, "multiplier"),
    baseRateMultiplier:
      input.baseRateMultiplier === null ||
      input.baseRateMultiplier === undefined
        ? null
        : parseDecimalInput(input.baseRateMultiplier, "baseRateMultiplier"),
    capAmountCents: input.capAmountCents ?? null,
    capPeriod: input.capPeriod ?? null,
    activationRequired: input.activationRequired ?? false,
    startsAt: parseNullableDate(input.startsAt) ?? null,
    endsAt: parseNullableDate(input.endsAt) ?? null,
    confidence: input.confidence,
    sourceId: input.sourceId ?? null,
    notes: input.notes ?? null,
  };
}
