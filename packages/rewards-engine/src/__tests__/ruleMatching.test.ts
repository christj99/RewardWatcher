import { describe, expect, it } from "vitest";

import { baseRule, currencies, earningRule } from "../fixtures.js";
import {
  chooseBestRule,
  filterActiveRules,
  matchRuleForCard,
} from "../ruleMatching.js";
import type { EngineEarningRule } from "../types.js";

const timestamp = new Date("2026-02-15T00:00:00.000Z");

describe("rule matching", () => {
  it("merchant-specific rule beats category rule", () => {
    const rules = [
      earningRule("category", "card-1", currencies.amexMr, "DINING", "4"),
      {
        ...earningRule("merchant", "card-1", currencies.amexMr, "DINING", "2"),
        merchantId: "merchant-1",
      },
      baseRule("base", "card-1", currencies.amexMr, "1"),
    ];

    expect(match(rules)?.rule.id).toBe("merchant");
  });

  it("category rule beats base rule", () => {
    const rules = [
      earningRule("category", "card-1", currencies.amexMr, "DINING", "4"),
      baseRule("base", "card-1", currencies.amexMr, "5"),
    ];

    expect(match(rules)?.rule.id).toBe("category");
  });

  it("base rule is used when no category rule exists", () => {
    const rules = [baseRule("base", "card-1", currencies.amexMr, "1")];

    expect(match(rules)?.rule.id).toBe("base");
  });

  it("expired and future rules are ignored", () => {
    const rules: EngineEarningRule[] = [
      {
        ...earningRule("expired", "card-1", currencies.amexMr, "DINING", "10"),
        endsAt: "2025-12-31T00:00:00.000Z",
      },
      {
        ...earningRule("future", "card-1", currencies.amexMr, "DINING", "9"),
        startsAt: "2027-01-01T00:00:00.000Z",
      },
      earningRule("current", "card-1", currencies.amexMr, "DINING", "4"),
    ];

    expect(filterActiveRules(rules, timestamp).map((rule) => rule.id)).toEqual([
      "current",
    ]);
    expect(match(rules)?.rule.id).toBe("current");
  });

  it("higher multiplier wins among same-priority rules", () => {
    expect(
      chooseBestRule([
        earningRule("low", "card-1", currencies.amexMr, "DINING", "2"),
        earningRule("high", "card-1", currencies.amexMr, "DINING", "3"),
      ])?.id,
    ).toBe("high");
  });

  it("higher confidence tie-breaks equal multipliers", () => {
    expect(
      chooseBestRule([
        earningRule(
          "medium",
          "card-1",
          currencies.amexMr,
          "DINING",
          "3",
          "MEDIUM",
        ),
        earningRule("high", "card-1", currencies.amexMr, "DINING", "3", "HIGH"),
      ])?.id,
    ).toBe("high");
  });

  it("activationRequired adds warning and confidence downgrade", () => {
    const result = match([
      {
        ...earningRule(
          "activation",
          "card-1",
          currencies.amexMr,
          "DINING",
          "5",
        ),
        activationRequired: true,
      },
    ]);

    expect(result?.confidence).toBe("MEDIUM");
    expect(result?.warnings[0]).toContain("activation");
  });

  it("exhausted cap causes fallback to base rule", () => {
    const capped = {
      ...earningRule("capped", "card-1", currencies.amexMr, "DINING", "5"),
      capAmountCents: 10000,
      capPeriod: "QUARTERLY" as const,
    };
    const result = matchRuleForCard({
      cardId: "card-1",
      merchantId: "merchant-1",
      category: "DINING",
      amountCents: 5000,
      timestamp,
      rules: [capped, baseRule("base", "card-1", currencies.amexMr, "1")],
      capLedgers: [
        {
          id: "ledger-1",
          userId: "user-1",
          userCardId: "uc-1",
          earningRuleId: "capped",
          periodStart: "2026-01-01T00:00:00.000Z",
          periodEnd: "2026-03-31T23:59:59.000Z",
          usedAmountCents: 10000,
        },
      ],
    });

    expect(result?.rule.id).toBe("base");
    expect(result?.warnings[0]).toContain("exhausted");
  });

  it("returns null when no matching rule exists", () => {
    expect(
      matchRuleForCard({
        cardId: "card-1",
        merchantId: "merchant-1",
        category: "DINING",
        amountCents: 5000,
        timestamp,
        rules: [
          earningRule("grocery", "card-1", currencies.amexMr, "GROCERY", "4"),
        ],
        capLedgers: [],
      }),
    ).toBeNull();
  });
});

function match(rules: EngineEarningRule[]) {
  return matchRuleForCard({
    cardId: "card-1",
    merchantId: "merchant-1",
    category: "DINING",
    amountCents: 5000,
    timestamp,
    rules,
    capLedgers: [],
  });
}
