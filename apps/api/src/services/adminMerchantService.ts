import type {
  CardNetwork,
  ConfidenceLevel,
  MerchantCategory,
  PostingDataSource,
  Prisma,
  UrlPatternType,
} from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";
import {
  assertIssuerExists,
  assertMerchantExists,
  assertRuleSourceExists,
  assertUniqueSlug,
  parseNullableDate,
  slugify,
} from "./adminDataHelpers.js";

export async function listAdminMerchants(input: {
  q?: string | undefined;
  category?: MerchantCategory | undefined;
  limit: number;
}) {
  return prisma.merchant.findMany({
    where: {
      ...(input.category ? { category: input.category } : {}),
      ...(input.q
        ? {
            OR: [
              { name: { contains: input.q, mode: "insensitive" } },
              { slug: { contains: input.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: {
        select: {
          urlPatterns: true,
          postingProfiles: true,
          earningRules: true,
        },
      },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function createAdminMerchant(input: {
  name: string;
  slug?: string | undefined;
  category: MerchantCategory;
  websiteUrl?: string | null | undefined;
}) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  await assertUniqueSlug({ model: "merchant", slug });

  return prisma.merchant.create({
    data: {
      name: input.name,
      slug,
      category: input.category,
      websiteUrl: input.websiteUrl ?? null,
    },
  });
}

export async function getAdminMerchant(id: string) {
  const [merchant, recentCorrectionsCount, recentOutcomesCount] =
    await Promise.all([
      prisma.merchant.findUnique({
        where: { id },
        include: {
          urlPatterns: { include: { source: true } },
          postingProfiles: { include: { issuer: true, source: true } },
          earningRules: { include: { card: true, rewardCurrency: true } },
          statementCredits: { include: { card: true } },
        },
      }),
      prisma.recommendationCorrection.count({
        where: { recommendationEvent: { merchantId: id } },
      }),
      prisma.recommendationOutcome.count({
        where: { transaction: { merchantId: id } },
      }),
    ]);

  if (!merchant) {
    throw notFound("Merchant was not found.");
  }

  return { ...merchant, recentCorrectionsCount, recentOutcomesCount };
}

export async function updateAdminMerchant(
  id: string,
  input: {
    name?: string | undefined;
    slug?: string | undefined;
    category?: MerchantCategory | undefined;
    websiteUrl?: string | null | undefined;
  },
) {
  await assertMerchantExists(id);
  const slug = input.slug ? slugify(input.slug) : undefined;

  if (slug) {
    await assertUniqueSlug({ model: "merchant", slug, currentId: id });
  }

  return prisma.merchant.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.websiteUrl !== undefined
        ? { websiteUrl: input.websiteUrl }
        : {}),
    },
  });
}

export async function createAdminMerchantUrlPattern(
  merchantId: string,
  input: {
    pattern: string;
    patternType: UrlPatternType;
    confidence: ConfidenceLevel;
    sourceId?: string | null | undefined;
  },
) {
  await Promise.all([
    assertMerchantExists(merchantId),
    assertRuleSourceExists(input.sourceId),
  ]);

  return prisma.merchantUrlPattern.create({
    data: {
      merchantId,
      pattern: input.pattern,
      patternType: input.patternType,
      confidence: input.confidence,
      sourceId: input.sourceId ?? null,
    },
    include: { merchant: true, source: true },
  });
}

export async function updateAdminMerchantUrlPattern(
  id: string,
  input: {
    pattern?: string | undefined;
    patternType?: UrlPatternType | undefined;
    confidence?: ConfidenceLevel | undefined;
    sourceId?: string | null | undefined;
  },
) {
  await getMerchantUrlPattern(id);
  await assertRuleSourceExists(input.sourceId);

  return prisma.merchantUrlPattern.update({
    where: { id },
    data: {
      ...(input.pattern !== undefined ? { pattern: input.pattern } : {}),
      ...(input.patternType !== undefined
        ? { patternType: input.patternType }
        : {}),
      ...(input.confidence !== undefined
        ? { confidence: input.confidence }
        : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
    },
    include: { merchant: true, source: true },
  });
}

export async function deleteAdminMerchantUrlPattern(id: string) {
  await getMerchantUrlPattern(id);
  return prisma.merchantUrlPattern.delete({ where: { id } });
}

export async function listAdminPostingProfiles(input: {
  merchantId?: string | undefined;
  issuerId?: string | undefined;
  network?: CardNetwork | undefined;
  observedCategory?: MerchantCategory | undefined;
  confidence?: ConfidenceLevel | undefined;
  limit: number;
}) {
  return prisma.merchantPostingProfile.findMany({
    where: {
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.issuerId ? { issuerId: input.issuerId } : {}),
      ...(input.network ? { network: input.network } : {}),
      ...(input.observedCategory
        ? { observedCategory: input.observedCategory }
        : {}),
      ...(input.confidence ? { confidence: input.confidence } : {}),
    },
    include: { merchant: true, issuer: true, source: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: input.limit,
  });
}

export async function createAdminPostingProfile(input: PostingProfileInput) {
  await validatePostingProfile(input);

  return prisma.merchantPostingProfile.create({
    data: mapPostingProfileData(input),
    include: { merchant: true, issuer: true, source: true },
  });
}

export async function updateAdminPostingProfile(
  id: string,
  input: PostingProfileUpdateInput,
) {
  const existing = await getPostingProfile(id);
  const merged: PostingProfileInput = {
    merchantId: input.merchantId ?? existing.merchantId,
    issuerId: input.issuerId === undefined ? existing.issuerId : input.issuerId,
    network: input.network === undefined ? existing.network : input.network,
    observedCategory: input.observedCategory ?? existing.observedCategory,
    observedMcc:
      input.observedMcc === undefined
        ? existing.observedMcc
        : input.observedMcc,
    dataSource: input.dataSource ?? existing.dataSource,
    confidence: input.confidence ?? existing.confidence,
    observationCount: input.observationCount ?? existing.observationCount,
    lastObservedAt:
      input.lastObservedAt === undefined
        ? existing.lastObservedAt?.toISOString()
        : input.lastObservedAt,
    sourceId: input.sourceId === undefined ? existing.sourceId : input.sourceId,
    notes: input.notes === undefined ? existing.notes : input.notes,
  };
  await validatePostingProfile(merged);

  return prisma.merchantPostingProfile.update({
    where: { id },
    data: mapPostingProfileData(merged),
    include: { merchant: true, issuer: true, source: true },
  });
}

async function getMerchantUrlPattern(id: string) {
  const pattern = await prisma.merchantUrlPattern.findUnique({ where: { id } });
  if (!pattern) {
    throw notFound("Merchant URL pattern was not found.");
  }
  return pattern;
}

async function getPostingProfile(id: string) {
  const profile = await prisma.merchantPostingProfile.findUnique({
    where: { id },
  });
  if (!profile) {
    throw notFound("Merchant posting profile was not found.");
  }
  return profile;
}

type PostingProfileInput = {
  merchantId: string;
  issuerId?: string | null | undefined;
  network?: CardNetwork | null | undefined;
  observedCategory: MerchantCategory;
  observedMcc?: string | null | undefined;
  dataSource: PostingDataSource;
  confidence: ConfidenceLevel;
  observationCount?: number | undefined;
  lastObservedAt?: string | null | undefined;
  sourceId?: string | null | undefined;
  notes?: string | null | undefined;
};

type PostingProfileUpdateInput = {
  [K in keyof PostingProfileInput]?: PostingProfileInput[K] | undefined;
};

async function validatePostingProfile(input: PostingProfileInput) {
  await Promise.all([
    assertMerchantExists(input.merchantId),
    input.issuerId ? assertIssuerExists(input.issuerId) : Promise.resolve(),
    assertRuleSourceExists(input.sourceId),
  ]);
}

function mapPostingProfileData(
  input: PostingProfileInput,
): Prisma.MerchantPostingProfileUncheckedCreateInput {
  return {
    merchantId: input.merchantId,
    issuerId: input.issuerId ?? null,
    network: input.network ?? null,
    observedCategory: input.observedCategory,
    observedMcc: input.observedMcc ?? null,
    dataSource: input.dataSource,
    confidence: input.confidence,
    observationCount: input.observationCount ?? 0,
    lastObservedAt: parseNullableDate(input.lastObservedAt) ?? null,
    sourceId: input.sourceId ?? null,
    notes: input.notes ?? null,
  };
}
