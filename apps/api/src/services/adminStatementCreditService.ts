import type {
  ConfidenceLevel,
  MerchantCategory,
  Prisma,
  Recurrence,
} from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import {
  assertCardExists,
  assertCardVersionBelongsToCard,
  assertDateOrder,
  assertMerchantExists,
  assertRuleSourceExists,
  parseNullableDate,
} from "./adminDataHelpers.js";

type StatementCreditInput = {
  cardId: string;
  cardVersionId?: string | null | undefined;
  name: string;
  description: string;
  amountCents: number;
  recurrence: Recurrence;
  merchantId?: string | null | undefined;
  category?: MerchantCategory | null | undefined;
  activationRequired?: boolean | undefined;
  confidence: ConfidenceLevel;
  sourceId?: string | null | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
};

type StatementCreditUpdateInput = {
  [K in keyof StatementCreditInput]?: StatementCreditInput[K] | undefined;
};

export async function listAdminStatementCredits(input: {
  cardId?: string | undefined;
  merchantId?: string | undefined;
  category?: MerchantCategory | undefined;
  recurrence?: Recurrence | undefined;
  limit: number;
}) {
  return prisma.statementCredit.findMany({
    where: {
      ...(input.cardId ? { cardId: input.cardId } : {}),
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.recurrence ? { recurrence: input.recurrence } : {}),
    },
    include: {
      card: { include: { issuer: true } },
      merchant: true,
      source: true,
      cardVersion: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function createAdminStatementCredit(input: StatementCreditInput) {
  await validateStatementCredit(input);

  return prisma.statementCredit.create({
    data: mapStatementCreditData(input),
    include: {
      card: { include: { issuer: true } },
      merchant: true,
      source: true,
      cardVersion: true,
    },
  });
}

export async function getAdminStatementCredit(id: string) {
  const credit = await prisma.statementCredit.findUnique({
    where: { id },
    include: {
      card: { include: { issuer: true } },
      merchant: true,
      source: true,
      cardVersion: true,
    },
  });

  if (!credit) {
    throw notFound("Statement credit was not found.");
  }

  return credit;
}

export async function updateAdminStatementCredit(
  id: string,
  input: StatementCreditUpdateInput,
) {
  const existing = await getAdminStatementCredit(id);
  const merged: StatementCreditInput = {
    cardId: input.cardId ?? existing.cardId,
    cardVersionId:
      input.cardVersionId === undefined
        ? existing.cardVersionId
        : input.cardVersionId,
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
    amountCents: input.amountCents ?? existing.amountCents,
    recurrence: input.recurrence ?? existing.recurrence,
    merchantId:
      input.merchantId === undefined ? existing.merchantId : input.merchantId,
    category: input.category === undefined ? existing.category : input.category,
    activationRequired: input.activationRequired ?? existing.activationRequired,
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
  await validateStatementCredit(merged);

  return prisma.statementCredit.update({
    where: { id },
    data: mapStatementCreditData(merged),
  });
}

async function validateStatementCredit(input: StatementCreditInput) {
  await Promise.all([
    assertCardExists(input.cardId),
    input.merchantId
      ? assertMerchantExists(input.merchantId)
      : Promise.resolve(),
    assertRuleSourceExists(input.sourceId),
  ]);
  await assertCardVersionBelongsToCard(input.cardVersionId, input.cardId);
  assertDateOrder(input.startsAt, input.endsAt);
}

function mapStatementCreditData(
  input: StatementCreditInput,
): Prisma.StatementCreditUncheckedCreateInput {
  return {
    cardId: input.cardId,
    cardVersionId: input.cardVersionId ?? null,
    name: input.name,
    description: input.description,
    amountCents: input.amountCents,
    recurrence: input.recurrence,
    merchantId: input.merchantId ?? null,
    category: input.category ?? null,
    activationRequired: input.activationRequired ?? false,
    confidence: input.confidence,
    sourceId: input.sourceId ?? null,
    startsAt: parseNullableDate(input.startsAt) ?? null,
    endsAt: parseNullableDate(input.endsAt) ?? null,
  };
}
