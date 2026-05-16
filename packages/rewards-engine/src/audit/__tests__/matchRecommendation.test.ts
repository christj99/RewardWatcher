import { describe, expect, it } from "vitest";

import type {
  AuditRecommendationCandidate,
  AuditTransactionInput,
} from "../auditTypes.js";
import { matchRecommendationToTransaction } from "../matchRecommendation.js";

const transaction: AuditTransactionInput = {
  id: "txn-1",
  userId: "user-1",
  userCardId: "uc-1",
  merchantId: "merchant-1",
  rawMerchantName: "STARBUCKS STORE #1234",
  amountCents: 5000,
  currencyCode: "USD",
  transactionDate: "2026-05-08T12:00:00.000Z",
  source: "MANUAL",
  observedCategory: "DINING",
};

describe("recommendation matching", () => {
  it("matches same merchant within same day", () => {
    const result = matchRecommendationToTransaction(transaction, [
      candidate({ createdAt: "2026-05-08T10:00:00.000Z" }),
    ]);

    expect(result.matched).toBe(true);
    expect(result.recommendationEventId).toBe("rec-1");
  });

  it("matches same merchant within 7 days", () => {
    const result = matchRecommendationToTransaction(transaction, [
      candidate({ createdAt: "2026-05-02T10:00:00.000Z" }),
    ]);

    expect(result.matched).toBe(true);
  });

  it("excludes candidate outside window", () => {
    const result = matchRecommendationToTransaction(transaction, [
      candidate({ createdAt: "2026-04-20T10:00:00.000Z" }),
    ]);

    expect(result.matched).toBe(false);
  });

  it("excludes candidate created after transaction", () => {
    const result = matchRecommendationToTransaction(transaction, [
      candidate({ createdAt: "2026-05-09T10:00:00.000Z" }),
    ]);

    expect(result.matched).toBe(false);
  });

  it("exact amount match scores higher than missing amount", () => {
    const result = matchRecommendationToTransaction(transaction, [
      candidate({ id: "missing", purchaseAmountCents: null }),
      candidate({ id: "exact", purchaseAmountCents: 5000 }),
    ]);

    expect(result.recommendationEventId).toBe("exact");
  });

  it("excludes clear amount mismatches", () => {
    const result = matchRecommendationToTransaction(transaction, [
      candidate({ purchaseAmountCents: 100 }),
    ]);

    expect(result.matched).toBe(false);
  });

  it("merchant id match beats name similarity", () => {
    const result = matchRecommendationToTransaction(transaction, [
      candidate({
        id: "name",
        merchantId: null,
        merchantNameInput: "Starbucks",
      }),
      candidate({
        id: "id",
        merchantId: "merchant-1",
        merchantNameInput: "Coffee",
      }),
    ]);

    expect(result.recommendationEventId).toBe("id");
  });

  it("uses most recent recommendation as deterministic tie-breaker", () => {
    const result = matchRecommendationToTransaction(transaction, [
      candidate({ id: "older", createdAt: "2026-05-08T09:00:00.000Z" }),
      candidate({ id: "newer", createdAt: "2026-05-08T10:00:00.000Z" }),
    ]);

    expect(result.recommendationEventId).toBe("newer");
  });

  it("different user is excluded", () => {
    const result = matchRecommendationToTransaction(transaction, [
      candidate({ userId: "user-2" }),
    ]);

    expect(result.matched).toBe(false);
  });

  it("no candidate above threshold returns unmatched", () => {
    const result = matchRecommendationToTransaction(transaction, [
      candidate({
        merchantId: null,
        merchantNameInput: "Target",
        purchaseAmountCents: 100,
        expectedCategory: "GENERAL",
      }),
    ]);

    expect(result.matched).toBe(false);
  });
});

function candidate(
  overrides: Partial<AuditRecommendationCandidate> = {},
): AuditRecommendationCandidate {
  return {
    id: "rec-1",
    userId: "user-1",
    merchantId: "merchant-1",
    merchantNameInput: "Starbucks",
    purchaseAmountCents: 5000,
    context: "MANUAL_LOOKUP",
    lens: "PRACTICAL",
    recommendedUserCardId: "uc-best",
    recommendedCardId: "card-best",
    expectedCategory: "DINING",
    expectedValueCents: 320,
    confidence: "HIGH",
    explanation: "Fixture.",
    createdAt: "2026-05-08T09:00:00.000Z",
    ...overrides,
  };
}
