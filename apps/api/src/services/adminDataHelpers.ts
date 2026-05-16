import { Prisma } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { badRequest, conflict, notFound } from "../lib/httpErrors.js";

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseNullableDate(
  value?: string | null,
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === null ? null : new Date(value);
}

export function parseDecimalInput(
  value: string | number,
  fieldName: string,
): Prisma.Decimal {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw badRequest(`${fieldName} must be greater than zero.`);
  }

  return new Prisma.Decimal(value);
}

export function assertDateOrder(
  startsAt?: string | null,
  endsAt?: string | null,
  startLabel = "startsAt",
  endLabel = "endsAt",
): void {
  if (!startsAt || !endsAt) {
    return;
  }

  if (new Date(endsAt) <= new Date(startsAt)) {
    throw badRequest(`${endLabel} must be after ${startLabel}.`);
  }
}

export function assertNonNegative(
  value: number | null | undefined,
  fieldName: string,
): void {
  if (value !== null && value !== undefined && value < 0) {
    throw badRequest(`${fieldName} must be greater than or equal to zero.`);
  }
}

export async function assertIssuerExists(id: string): Promise<void> {
  if (
    !(await prisma.issuer.findUnique({ where: { id }, select: { id: true } }))
  ) {
    throw notFound("Issuer was not found.");
  }
}

export async function assertCardExists(id: string): Promise<void> {
  if (
    !(await prisma.card.findUnique({ where: { id }, select: { id: true } }))
  ) {
    throw notFound("Card was not found.");
  }
}

export async function assertCurrencyExists(id: string): Promise<void> {
  if (
    !(await prisma.currency.findUnique({ where: { id }, select: { id: true } }))
  ) {
    throw notFound("Currency was not found.");
  }
}

export async function assertMerchantExists(id: string): Promise<void> {
  if (
    !(await prisma.merchant.findUnique({ where: { id }, select: { id: true } }))
  ) {
    throw notFound("Merchant was not found.");
  }
}

export async function assertRuleSourceExists(
  id: string | null | undefined,
): Promise<void> {
  if (!id) {
    return;
  }

  if (
    !(await prisma.ruleSource.findUnique({
      where: { id },
      select: { id: true },
    }))
  ) {
    throw notFound("Rule source was not found.");
  }
}

export async function assertCardVersionBelongsToCard(
  cardVersionId: string | null | undefined,
  cardId: string,
): Promise<void> {
  if (!cardVersionId) {
    return;
  }

  const version = await prisma.cardVersion.findUnique({
    where: { id: cardVersionId },
    select: { id: true, cardId: true },
  });

  if (!version) {
    throw notFound("Card version was not found.");
  }

  if (version.cardId !== cardId) {
    throw badRequest("Card version must belong to the selected card.");
  }
}

export async function assertUniqueSlug(input: {
  model: "issuer" | "card" | "merchant";
  slug: string;
  currentId?: string | undefined;
}): Promise<void> {
  const existing = await findSlugOwner(input.model, input.slug);

  if (existing && existing.id !== input.currentId) {
    throw conflict(`${capitalize(input.model)} slug already exists.`);
  }
}

export async function assertUniqueCurrencyCode(
  code: string,
  currentId?: string,
): Promise<void> {
  const existing = await prisma.currency.findUnique({
    where: { code },
    select: { id: true },
  });

  if (existing && existing.id !== currentId) {
    throw conflict("Currency code already exists.");
  }
}

async function findSlugOwner(
  model: "issuer" | "card" | "merchant",
  slug: string,
) {
  if (model === "issuer") {
    return prisma.issuer.findUnique({ where: { slug }, select: { id: true } });
  }

  if (model === "card") {
    return prisma.card.findUnique({ where: { slug }, select: { id: true } });
  }

  return prisma.merchant.findUnique({ where: { slug }, select: { id: true } });
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
