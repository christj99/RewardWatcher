import type {
  AuditRecommendationCandidate,
  AuditTransactionInput,
  RecommendationMatchResult,
} from "./auditTypes.js";
import {
  merchantNameSimilarityScore,
  merchantNamesSimilar,
  normalizeMerchantName,
} from "./merchantNormalize.js";

export type RecommendationMatchOptions = {
  maxDaysBeforeTransaction?: number;
  amountToleranceCents?: number;
  amountTolerancePercent?: number;
  minScore?: number;
};

export function matchRecommendationToTransaction(
  transaction: AuditTransactionInput,
  candidates: AuditRecommendationCandidate[],
  options: RecommendationMatchOptions = {},
): RecommendationMatchResult {
  const maxDays = options.maxDaysBeforeTransaction ?? 7;
  const amountToleranceCents = options.amountToleranceCents ?? 100;
  const amountTolerancePercent = options.amountTolerancePercent ?? 0.05;
  const minScore = options.minScore ?? 60;
  const transactionDate = new Date(transaction.transactionDate);

  const scored = candidates
    .filter((candidate) => candidate.userId === transaction.userId)
    .map((candidate) =>
      scoreCandidate({
        transaction,
        candidate,
        transactionDate,
        maxDays,
        amountToleranceCents,
        amountTolerancePercent,
      }),
    )
    .filter((result): result is CandidateScore => Boolean(result))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const createdAtDelta =
        new Date(b.candidate.createdAt).getTime() -
        new Date(a.candidate.createdAt).getTime();
      if (createdAtDelta !== 0) {
        return createdAtDelta;
      }

      return a.candidate.id.localeCompare(b.candidate.id);
    });

  const best = scored[0];
  if (!best || best.score < minScore) {
    return {
      score: best?.score ?? 0,
      matched: false,
      reasons: best?.reasons ?? [],
      warnings: ["No prior recommendation matched this transaction."],
    };
  }

  return {
    recommendationEventId: best.candidate.id,
    score: best.score,
    matched: true,
    reasons: best.reasons,
    warnings: best.warnings,
  };
}

type CandidateScore = {
  candidate: AuditRecommendationCandidate;
  score: number;
  reasons: string[];
  warnings: string[];
};

function scoreCandidate(input: {
  transaction: AuditTransactionInput;
  candidate: AuditRecommendationCandidate;
  transactionDate: Date;
  maxDays: number;
  amountToleranceCents: number;
  amountTolerancePercent: number;
}): CandidateScore | null {
  const createdAt = new Date(input.candidate.createdAt);
  if (createdAt > input.transactionDate) {
    return null;
  }

  const ageMs = input.transactionDate.getTime() - createdAt.getTime();
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (ageDays > input.maxDays) {
    return null;
  }

  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (
    input.transaction.merchantId &&
    input.candidate.merchantId &&
    input.transaction.merchantId === input.candidate.merchantId
  ) {
    score += 50;
    reasons.push("Merchant id matched.");
  } else if (candidateNameMatches(input.transaction, input.candidate)) {
    const similarity = candidateNameSimilarity(
      input.transaction,
      input.candidate,
    );
    score += 30;
    reasons.push(`Merchant name matched with score ${similarity}.`);
  }

  if (input.candidate.purchaseAmountCents) {
    const delta = Math.abs(
      input.transaction.amountCents - input.candidate.purchaseAmountCents,
    );
    const percentDelta = delta / input.candidate.purchaseAmountCents;
    if (delta === 0) {
      score += 25;
      reasons.push("Amount matched exactly.");
    } else if (delta <= input.amountToleranceCents) {
      score += 20;
      reasons.push("Amount matched within cent tolerance.");
    } else if (percentDelta <= input.amountTolerancePercent) {
      score += 15;
      reasons.push("Amount matched within percent tolerance.");
    } else {
      return null;
    }
  } else {
    score += 5;
    reasons.push("Recommendation amount was missing.");
  }

  if (ageDays === 0) {
    score += 20;
    reasons.push("Recommendation was created the same day.");
  } else if (ageDays <= 2) {
    score += 15;
    reasons.push("Recommendation was created one to two days before.");
  } else {
    score += 10;
    reasons.push("Recommendation was created within the audit window.");
  }

  if (input.candidate.context === "ONLINE_CHECKOUT") {
    score += 5;
    reasons.push("Online checkout recommendation context.");
  } else if (input.candidate.context === "MANUAL_LOOKUP") {
    score += 3;
    reasons.push("Manual lookup recommendation context.");
  }

  if (
    input.transaction.observedCategory &&
    input.transaction.observedCategory !== "UNKNOWN"
  ) {
    if (
      input.transaction.observedCategory === input.candidate.expectedCategory
    ) {
      score += 10;
      reasons.push("Observed category matched expected category.");
    } else {
      score -= 5;
      warnings.push("Observed category differs from recommendation category.");
    }
  }

  return {
    candidate: input.candidate,
    score,
    reasons,
    warnings,
  };
}

function candidateNameMatches(
  transaction: AuditTransactionInput,
  candidate: AuditRecommendationCandidate,
): boolean {
  return candidateMerchantNames(candidate).some((name) =>
    merchantNamesSimilar(transaction.rawMerchantName, name),
  );
}

function candidateNameSimilarity(
  transaction: AuditTransactionInput,
  candidate: AuditRecommendationCandidate,
): number {
  return Math.max(
    ...candidateMerchantNames(candidate).map((name) =>
      merchantNameSimilarityScore(transaction.rawMerchantName, name),
    ),
    0,
  );
}

function candidateMerchantNames(
  candidate: AuditRecommendationCandidate,
): string[] {
  const names = [
    candidate.merchantNameInput,
    snapshotMerchantName(candidate.inputSnapshot),
  ].filter((value): value is string => Boolean(value));

  return names.map(normalizeMerchantName);
}

function snapshotMerchantName(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const candidate = snapshot as {
    resolvedMerchant?: { name?: unknown };
    originalInput?: { merchantName?: unknown };
    merchantName?: unknown;
  };

  if (typeof candidate.resolvedMerchant?.name === "string") {
    return candidate.resolvedMerchant.name;
  }

  if (typeof candidate.originalInput?.merchantName === "string") {
    return candidate.originalInput.merchantName;
  }

  return typeof candidate.merchantName === "string"
    ? candidate.merchantName
    : null;
}
