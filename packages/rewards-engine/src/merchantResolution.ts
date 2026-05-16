import type { RewardsEngineRepository } from "./repositories.js";
import type {
  ConfidenceLevel,
  EngineMerchantPostingProfile,
  ExpectedCategoryResolution,
  RecommendationInput,
  ResolvedMerchant,
} from "./types.js";

export async function resolveMerchant(
  input: RecommendationInput,
  repository: RewardsEngineRepository,
): Promise<ResolvedMerchant> {
  if (input.merchantId) {
    const merchant = await repository.findMerchantById(input.merchantId);
    if (!merchant) {
      return {
        category: "UNKNOWN",
        confidence: "UNKNOWN",
        resolutionMethod: "ID",
        warnings: [`Merchant id ${input.merchantId} could not be resolved.`],
      };
    }

    return {
      id: merchant.id,
      name: merchant.name,
      category: merchant.category,
      confidence: "HIGH",
      resolutionMethod: "ID",
      warnings: [],
    };
  }

  if (input.merchantUrl) {
    const normalizedUrl = normalizeMerchantUrl(input.merchantUrl);
    if (!normalizedUrl) {
      return {
        category: "UNKNOWN",
        confidence: "UNKNOWN",
        resolutionMethod: "URL",
        warnings: [`Merchant URL "${input.merchantUrl}" could not be parsed.`],
      };
    }

    const merchant = await repository.findMerchantByUrl(normalizedUrl);
    if (!merchant) {
      return {
        category: "UNKNOWN",
        confidence: "UNKNOWN",
        resolutionMethod: "URL",
        warnings: [
          `Merchant URL "${input.merchantUrl}" could not be resolved.`,
        ],
      };
    }

    return {
      id: merchant.id,
      name: merchant.name,
      category: merchant.category,
      confidence: "MEDIUM",
      resolutionMethod: "URL",
      warnings: [],
    };
  }

  if (input.merchantName) {
    const merchant = await repository.findMerchantByName(input.merchantName);
    if (!merchant) {
      return {
        name: input.merchantName,
        category: "UNKNOWN",
        confidence: "UNKNOWN",
        resolutionMethod: "NAME",
        warnings: [
          `Merchant name "${input.merchantName}" could not be resolved.`,
        ],
      };
    }

    return {
      id: merchant.id,
      name: merchant.name,
      category: merchant.category,
      confidence: "MEDIUM",
      resolutionMethod: "NAME",
      warnings: [],
    };
  }

  return {
    category: "UNKNOWN",
    confidence: "UNKNOWN",
    resolutionMethod: "UNKNOWN",
    warnings: ["This merchant could not be resolved; using UNKNOWN category."],
  };
}

export function normalizeMerchantUrl(urlOrDomain: string): string | null {
  const trimmed = urlOrDomain.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".")) {
      return null;
    }

    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function resolveExpectedCategory(
  resolvedMerchant: ResolvedMerchant,
  postingProfiles: EngineMerchantPostingProfile[],
): ExpectedCategoryResolution {
  if (!resolvedMerchant.id) {
    return {
      category: "UNKNOWN",
      confidence: "UNKNOWN",
      warnings: resolvedMerchant.warnings,
    };
  }

  const bestProfile = chooseBestPostingProfile(postingProfiles);
  if (!bestProfile) {
    return {
      category: resolvedMerchant.category,
      confidence: resolvedMerchant.confidence,
      warnings: [],
    };
  }

  const warnings =
    bestProfile.observedCategory !== resolvedMerchant.category
      ? [
          "The expected category is based on observed posting behavior that differs from the merchant default category.",
        ]
      : [];

  return {
    category: bestProfile.observedCategory,
    confidence: minCategoryConfidence(
      resolvedMerchant.confidence,
      bestProfile.confidence,
    ),
    postingProfileId: bestProfile.id,
    warnings,
  };
}

function chooseBestPostingProfile(
  profiles: EngineMerchantPostingProfile[],
): EngineMerchantPostingProfile | undefined {
  return profiles
    .filter((profile) => profile.confidence !== "UNKNOWN")
    .sort((a, b) => {
      const confidenceDelta =
        postingConfidenceRank(b.confidence) -
        postingConfidenceRank(a.confidence);
      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }

      return a.id.localeCompare(b.id);
    })[0];
}

function minCategoryConfidence(
  merchantConfidence: ConfidenceLevel,
  postingConfidence: ConfidenceLevel,
): ConfidenceLevel {
  return postingConfidenceRank(merchantConfidence) <
    postingConfidenceRank(postingConfidence)
    ? merchantConfidence
    : postingConfidence;
}

function postingConfidenceRank(confidence: ConfidenceLevel): number {
  return {
    UNKNOWN: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
  }[confidence];
}
