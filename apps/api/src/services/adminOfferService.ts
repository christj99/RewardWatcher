import type {
  ConfidenceLevel,
  IssuerOfferType,
  MerchantCategory,
  Prisma,
} from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { badRequest, notFound } from "../lib/httpErrors.js";
import {
  assertCurrencyExists,
  assertDateOrder,
  assertIssuerExists,
  assertMerchantExists,
  assertRuleSourceExists,
  parseNullableDate,
} from "./adminDataHelpers.js";

type OfferInput = {
  issuerId?: string | null | undefined;
  cardId?: string | null | undefined;
  merchantId?: string | null | undefined;
  category?: MerchantCategory | null | undefined;
  title: string;
  description: string;
  offerType: IssuerOfferType;
  valueCents?: number | null | undefined;
  bonusPoints?: number | null | undefined;
  bonusCurrencyId?: string | null | undefined;
  bonusMultiplier?: string | number | null | undefined;
  minSpendCents?: number | null | undefined;
  maxRewardCents?: number | null | undefined;
  activationRequired?: boolean | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
  confidence: ConfidenceLevel;
  sourceId?: string | null | undefined;
  termsUrl?: string | null | undefined;
  notes?: string | null | undefined;
};

type OfferUpdateInput = {
  [K in keyof OfferInput]?: OfferInput[K] | undefined;
};

const offerInclude = {
  issuer: true,
  card: { include: { issuer: true } },
  merchant: true,
  bonusCurrency: true,
  source: true,
} satisfies Prisma.IssuerOfferInclude;

export async function listAdminOffers(input: {
  issuerId?: string | undefined;
  cardId?: string | undefined;
  merchantId?: string | undefined;
  category?: MerchantCategory | undefined;
  offerType?: IssuerOfferType | undefined;
  confidence?: ConfidenceLevel | undefined;
  activeAt?: string | undefined;
  limit: number;
}) {
  const activeAt = input.activeAt ? new Date(input.activeAt) : undefined;
  return prisma.issuerOffer.findMany({
    where: {
      ...(input.issuerId ? { issuerId: input.issuerId } : {}),
      ...(input.cardId ? { cardId: input.cardId } : {}),
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.offerType ? { offerType: input.offerType } : {}),
      ...(input.confidence ? { confidence: input.confidence } : {}),
      ...(activeAt
        ? {
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: activeAt } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: activeAt } }] },
            ],
          }
        : {}),
    },
    include: offerInclude,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function createAdminOffer(input: OfferInput) {
  await validateOffer(input);
  return prisma.issuerOffer.create({
    data: mapOfferData(input),
    include: offerInclude,
  });
}

export async function getAdminOffer(id: string) {
  const offer = await prisma.issuerOffer.findUnique({
    where: { id },
    include: offerInclude,
  });
  if (!offer) {
    throw notFound("Offer was not found.");
  }
  return offer;
}

export async function updateAdminOffer(id: string, input: OfferUpdateInput) {
  const existing = await getAdminOffer(id);
  const merged: OfferInput = {
    issuerId: input.issuerId === undefined ? existing.issuerId : input.issuerId,
    cardId: input.cardId === undefined ? existing.cardId : input.cardId,
    merchantId:
      input.merchantId === undefined ? existing.merchantId : input.merchantId,
    category: input.category === undefined ? existing.category : input.category,
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    offerType: input.offerType ?? existing.offerType,
    valueCents:
      input.valueCents === undefined ? existing.valueCents : input.valueCents,
    bonusPoints:
      input.bonusPoints === undefined
        ? existing.bonusPoints
        : input.bonusPoints,
    bonusCurrencyId:
      input.bonusCurrencyId === undefined
        ? existing.bonusCurrencyId
        : input.bonusCurrencyId,
    bonusMultiplier:
      input.bonusMultiplier === undefined
        ? existing.bonusMultiplier?.toString()
        : input.bonusMultiplier,
    minSpendCents:
      input.minSpendCents === undefined
        ? existing.minSpendCents
        : input.minSpendCents,
    maxRewardCents:
      input.maxRewardCents === undefined
        ? existing.maxRewardCents
        : input.maxRewardCents,
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
    termsUrl: input.termsUrl === undefined ? existing.termsUrl : input.termsUrl,
    notes: input.notes === undefined ? existing.notes : input.notes,
  };
  await validateOffer(merged);
  return prisma.issuerOffer.update({
    where: { id },
    data: mapOfferData(merged),
    include: offerInclude,
  });
}

export async function expireAdminOffer(
  id: string,
  input: { endsAt?: string | undefined; notes?: string | undefined },
) {
  const existing = await getAdminOffer(id);
  const endsAt = input.endsAt ? new Date(input.endsAt) : new Date();
  return prisma.issuerOffer.update({
    where: { id },
    data: {
      endsAt,
      notes: input.notes
        ? [existing.notes, input.notes].filter(Boolean).join("\n")
        : existing.notes,
    },
    include: offerInclude,
  });
}

async function validateOffer(input: OfferInput): Promise<void> {
  if (
    !input.issuerId &&
    !input.cardId &&
    !input.merchantId &&
    !input.category
  ) {
    throw badRequest("At least one offer targeting field is required.");
  }
  await Promise.all([
    input.issuerId ? assertIssuerExists(input.issuerId) : Promise.resolve(),
    input.merchantId
      ? assertMerchantExists(input.merchantId)
      : Promise.resolve(),
    input.bonusCurrencyId
      ? assertCurrencyExists(input.bonusCurrencyId)
      : Promise.resolve(),
    assertRuleSourceExists(input.sourceId),
  ]);

  if (input.cardId) {
    const card = await prisma.card.findUnique({
      where: { id: input.cardId },
      select: { issuerId: true },
    });
    if (!card) {
      throw notFound("Card was not found.");
    }
    if (input.issuerId && input.issuerId !== card.issuerId) {
      throw badRequest("Card must belong to the selected issuer.");
    }
  }

  assertDateOrder(input.startsAt, input.endsAt);
  validateOfferEconomics(input);
}

function validateOfferEconomics(input: OfferInput): void {
  if (
    (input.offerType === "STATEMENT_CREDIT" ||
      input.offerType === "DISCOUNT") &&
    !input.valueCents &&
    !input.notes
  ) {
    throw badRequest(`${input.offerType} offers require valueCents or notes.`);
  }
  if (
    input.offerType === "BONUS_POINTS" &&
    (!input.bonusPoints || !input.bonusCurrencyId)
  ) {
    throw badRequest(
      "BONUS_POINTS offers require bonusPoints and bonusCurrencyId.",
    );
  }
  if (
    input.offerType === "BONUS_MULTIPLIER" &&
    (!input.bonusMultiplier || !input.bonusCurrencyId)
  ) {
    throw badRequest(
      "BONUS_MULTIPLIER offers require bonusMultiplier and bonusCurrencyId.",
    );
  }
}

function mapOfferData(
  input: OfferInput,
): Prisma.IssuerOfferUncheckedCreateInput {
  return {
    issuerId: input.issuerId ?? null,
    cardId: input.cardId ?? null,
    merchantId: input.merchantId ?? null,
    category: input.category ?? null,
    title: input.title,
    description: input.description,
    offerType: input.offerType,
    valueCents: input.valueCents ?? null,
    bonusPoints: input.bonusPoints ?? null,
    bonusCurrencyId: input.bonusCurrencyId ?? null,
    bonusMultiplier:
      input.bonusMultiplier === null || input.bonusMultiplier === undefined
        ? null
        : new PrismaNamespace.Decimal(input.bonusMultiplier),
    minSpendCents: input.minSpendCents ?? null,
    maxRewardCents: input.maxRewardCents ?? null,
    activationRequired: input.activationRequired ?? true,
    startsAt: parseNullableDate(input.startsAt) ?? null,
    endsAt: parseNullableDate(input.endsAt) ?? null,
    confidence: input.confidence,
    sourceId: input.sourceId ?? null,
    termsUrl: input.termsUrl ?? null,
    notes: input.notes ?? null,
  };
}
