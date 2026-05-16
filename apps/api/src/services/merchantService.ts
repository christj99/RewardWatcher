import type {
  ConfidenceLevel,
  Merchant,
  MerchantUrlPattern,
} from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { notFound } from "../lib/httpErrors.js";

export type MerchantUrlResolution = {
  merchant: Merchant;
  matchedPattern: Pick<MerchantUrlPattern, "id" | "pattern" | "patternType">;
  confidence: ConfidenceLevel;
};

export async function searchMerchants(q: string, limit: number) {
  return prisma.merchant.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit,
  });
}

export async function resolveMerchantByUrl(
  urlInput: string,
): Promise<MerchantUrlResolution> {
  const normalized = normalizeUrlForMatching(urlInput);
  const patterns = await prisma.merchantUrlPattern.findMany({
    include: {
      merchant: true,
    },
    orderBy: [{ patternType: "asc" }, { pattern: "asc" }, { id: "asc" }],
  });

  for (const pattern of patterns) {
    if (matchesPattern(normalized, pattern)) {
      return {
        merchant: pattern.merchant,
        matchedPattern: {
          id: pattern.id,
          pattern: pattern.pattern,
          patternType: pattern.patternType,
        },
        confidence: pattern.confidence,
      };
    }
  }

  throw notFound("No merchant matched the provided URL.");
}

export function normalizeUrlForMatching(urlInput: string): {
  href: string;
  host: string;
} {
  const trimmed = urlInput.trim();
  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(candidate);

  return {
    href: url.href.toLowerCase(),
    host: url.hostname.toLowerCase().replace(/^www\./, ""),
  };
}

function matchesPattern(
  normalized: { href: string; host: string },
  pattern: MerchantUrlPattern,
): boolean {
  const patternValue = pattern.pattern.toLowerCase().replace(/^www\./, "");

  if (pattern.patternType === "DOMAIN") {
    return (
      normalized.host === patternValue ||
      normalized.host.endsWith(`.${patternValue}`)
    );
  }

  if (pattern.patternType === "URL_CONTAINS") {
    return normalized.href.includes(patternValue);
  }

  if (pattern.patternType === "REGEX") {
    try {
      return new RegExp(pattern.pattern, "i").test(normalized.href);
    } catch {
      return false;
    }
  }

  return false;
}
