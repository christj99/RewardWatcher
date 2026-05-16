import type { BenefitType, ConfidenceLevel, Prisma } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import {
  assertCardExists,
  assertCardVersionBelongsToCard,
  assertDateOrder,
  assertRuleSourceExists,
  parseNullableDate,
} from "./adminDataHelpers.js";

type BenefitInput = {
  cardId: string;
  cardVersionId?: string | null | undefined;
  benefitType: BenefitType;
  name: string;
  description: string;
  estimatedValueCents?: number | null | undefined;
  confidence: ConfidenceLevel;
  sourceId?: string | null | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
};

type BenefitUpdateInput = {
  [K in keyof BenefitInput]?: BenefitInput[K] | undefined;
};

export async function listAdminBenefits(input: {
  cardId?: string | undefined;
  benefitType?: BenefitType | undefined;
  confidence?: ConfidenceLevel | undefined;
  limit: number;
}) {
  return prisma.benefit.findMany({
    where: {
      ...(input.cardId ? { cardId: input.cardId } : {}),
      ...(input.benefitType ? { benefitType: input.benefitType } : {}),
      ...(input.confidence ? { confidence: input.confidence } : {}),
    },
    include: {
      card: { include: { issuer: true } },
      source: true,
      cardVersion: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function createAdminBenefit(input: BenefitInput) {
  await validateBenefit(input);

  return prisma.benefit.create({
    data: mapBenefitData(input),
    include: {
      card: { include: { issuer: true } },
      source: true,
      cardVersion: true,
    },
  });
}

export async function getAdminBenefit(id: string) {
  const benefit = await prisma.benefit.findUnique({
    where: { id },
    include: {
      card: { include: { issuer: true } },
      source: true,
      cardVersion: true,
    },
  });

  if (!benefit) {
    throw notFound("Benefit was not found.");
  }

  return benefit;
}

export async function updateAdminBenefit(
  id: string,
  input: BenefitUpdateInput,
) {
  const existing = await getAdminBenefit(id);
  const merged: BenefitInput = {
    cardId: input.cardId ?? existing.cardId,
    cardVersionId:
      input.cardVersionId === undefined
        ? existing.cardVersionId
        : input.cardVersionId,
    benefitType: input.benefitType ?? existing.benefitType,
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
    estimatedValueCents:
      input.estimatedValueCents === undefined
        ? existing.estimatedValueCents
        : input.estimatedValueCents,
    confidence: input.confidence ?? existing.confidence,
    sourceId: input.sourceId === undefined ? existing.sourceId : input.sourceId,
    startsAt:
      input.startsAt === undefined
        ? existing.startsAt?.toISOString()
        : input.startsAt,
    endsAt:
      input.endsAt === undefined
        ? existing.endsAt?.toISOString()
        : input.endsAt,
  };
  await validateBenefit(merged);

  return prisma.benefit.update({
    where: { id },
    data: mapBenefitData(merged),
  });
}

async function validateBenefit(input: BenefitInput) {
  await Promise.all([
    assertCardExists(input.cardId),
    assertRuleSourceExists(input.sourceId),
  ]);
  await assertCardVersionBelongsToCard(input.cardVersionId, input.cardId);
  assertDateOrder(input.startsAt, input.endsAt);
}

function mapBenefitData(
  input: BenefitInput,
): Prisma.BenefitUncheckedCreateInput {
  return {
    cardId: input.cardId,
    cardVersionId: input.cardVersionId ?? null,
    benefitType: input.benefitType,
    name: input.name,
    description: input.description,
    estimatedValueCents: input.estimatedValueCents ?? null,
    confidence: input.confidence,
    sourceId: input.sourceId ?? null,
    startsAt: parseNullableDate(input.startsAt) ?? null,
    endsAt: parseNullableDate(input.endsAt) ?? null,
  };
}
