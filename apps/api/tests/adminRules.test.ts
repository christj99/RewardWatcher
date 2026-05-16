import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";
import {
  adminHeaders,
  createAdminCard,
  createAdminRuleSource,
  seededCurrency,
  seededMerchant,
  uniqueSlug,
} from "./adminPhase8Utils.js";

describe("admin source, currency, earning rule, benefit, and statement credit APIs", () => {
  it("creates rule source and rejects invalid URL", async () => {
    const server = await buildSeededServer();
    const source = await createAdminRuleSource(server);
    const invalid = await server.inject({
      method: "POST",
      url: "/v1/admin/rule-sources",
      headers: adminHeaders,
      payload: {
        sourceType: "CURATOR_RESEARCH",
        title: `Invalid URL ${uniqueSlug("source")}`,
        url: "not-a-url",
      },
    });

    expect(source.id).toBeDefined();
    expect(invalid.statusCode).toBe(400);
    await server.close();
  });

  it("creates currency and valuation with uniqueness and positive valuation checks", async () => {
    const server = await buildSeededServer();
    const code = uniqueSlug("CUR").replace(/-/g, "_").toUpperCase();
    const currency = await server.inject({
      method: "POST",
      url: "/v1/admin/currencies",
      headers: adminHeaders,
      payload: { code, name: "Phase 8 Points", currencyType: "OTHER" },
    });
    const duplicate = await server.inject({
      method: "POST",
      url: "/v1/admin/currencies",
      headers: adminHeaders,
      payload: { code, name: "Duplicate", currencyType: "OTHER" },
    });
    const validValuation = await server.inject({
      method: "POST",
      url: `/v1/admin/currencies/${currency.json().id}/valuations`,
      headers: adminHeaders,
      payload: {
        lens: "PRACTICAL",
        centsPerPoint: "1.25",
        confidence: "MEDIUM",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    });
    const invalidValuation = await server.inject({
      method: "POST",
      url: `/v1/admin/currencies/${currency.json().id}/valuations`,
      headers: adminHeaders,
      payload: {
        lens: "CASH_OUT",
        centsPerPoint: 0,
        confidence: "HIGH",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(currency.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(409);
    expect(validValuation.statusCode).toBe(201);
    expect(invalidValuation.statusCode).toBe(400);
    await server.close();
  });

  it("validates earning rules and can update and retire a rule", async () => {
    const server = await buildSeededServer();
    const card = await createAdminCard(server);
    const source = await createAdminRuleSource(server);
    const currency = await seededCurrency();
    const merchant = await seededMerchant();
    const otherVersion = await prisma.cardVersion.findFirstOrThrow({
      where: { cardId: { not: card.id } },
    });
    const categoryRule = await server.inject({
      method: "POST",
      url: "/v1/admin/earning-rules",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        rewardCurrencyId: currency.id,
        category: "DINING",
        multiplier: "3",
        confidence: "HIGH",
        sourceId: source.id,
      },
    });
    const merchantRule = await server.inject({
      method: "POST",
      url: "/v1/admin/earning-rules",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        rewardCurrencyId: currency.id,
        merchantId: merchant.id,
        multiplier: "5",
        confidence: "MEDIUM",
        sourceId: source.id,
      },
    });
    const baseRule = await server.inject({
      method: "POST",
      url: "/v1/admin/earning-rules",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        rewardCurrencyId: currency.id,
        multiplier: "1",
        confidence: "MEDIUM",
        isBaseRule: true,
        notes: "Base earning rule from admin test.",
      },
    });
    const badCard = await server.inject({
      method: "POST",
      url: "/v1/admin/earning-rules",
      headers: adminHeaders,
      payload: {
        cardId: "missing",
        rewardCurrencyId: currency.id,
        category: "DINING",
        multiplier: "3",
        confidence: "HIGH",
        sourceId: source.id,
      },
    });
    const badVersion = await server.inject({
      method: "POST",
      url: "/v1/admin/earning-rules",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        cardVersionId: otherVersion.id,
        rewardCurrencyId: currency.id,
        category: "DINING",
        multiplier: "3",
        confidence: "HIGH",
        sourceId: source.id,
      },
    });
    const badCurrency = await server.inject({
      method: "POST",
      url: "/v1/admin/earning-rules",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        rewardCurrencyId: "missing",
        category: "DINING",
        multiplier: "3",
        confidence: "HIGH",
        sourceId: source.id,
      },
    });
    const badMultiplier = await server.inject({
      method: "POST",
      url: "/v1/admin/earning-rules",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        rewardCurrencyId: currency.id,
        category: "DINING",
        multiplier: 0,
        confidence: "HIGH",
        sourceId: source.id,
      },
    });
    const badCap = await server.inject({
      method: "POST",
      url: "/v1/admin/earning-rules",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        rewardCurrencyId: currency.id,
        category: "DINING",
        multiplier: "3",
        capAmountCents: 1000,
        confidence: "HIGH",
        sourceId: source.id,
      },
    });
    const badSource = await server.inject({
      method: "POST",
      url: "/v1/admin/earning-rules",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        rewardCurrencyId: currency.id,
        category: "DINING",
        multiplier: "3",
        confidence: "HIGH",
        sourceId: "missing",
      },
    });
    const update = await server.inject({
      method: "PATCH",
      url: `/v1/admin/earning-rules/${categoryRule.json().id}`,
      headers: adminHeaders,
      payload: { confidence: "LOW" },
    });
    const retire = await server.inject({
      method: "POST",
      url: `/v1/admin/earning-rules/${categoryRule.json().id}/retire`,
      headers: adminHeaders,
      payload: { notes: "Retired in test." },
    });

    expect(categoryRule.statusCode).toBe(201);
    expect(merchantRule.statusCode).toBe(201);
    expect(baseRule.statusCode).toBe(201);
    expect(badCard.statusCode).toBe(404);
    expect(badVersion.statusCode).toBe(400);
    expect(badCurrency.statusCode).toBe(404);
    expect(badMultiplier.statusCode).toBe(400);
    expect(badCap.statusCode).toBe(400);
    expect(badSource.statusCode).toBe(404);
    expect(update.json().confidence).toBe("LOW");
    expect(retire.json().endsAt).toBeDefined();

    await server.close();
  }, 15_000);

  it("creates benefits and statement credits with validation", async () => {
    const server = await buildSeededServer();
    const card = await createAdminCard(server);
    const merchant = await seededMerchant();
    const benefit = await server.inject({
      method: "POST",
      url: "/v1/admin/benefits",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        benefitType: "PURCHASE_PROTECTION",
        name: "Phase 8 Protection",
        description: "Test benefit.",
        confidence: "MEDIUM",
      },
    });
    const badBenefit = await server.inject({
      method: "POST",
      url: "/v1/admin/benefits",
      headers: adminHeaders,
      payload: {
        cardId: "missing",
        benefitType: "OTHER",
        name: "Bad",
        description: "Bad",
        confidence: "LOW",
      },
    });
    const credit = await server.inject({
      method: "POST",
      url: "/v1/admin/statement-credits",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        name: "Phase 8 Credit",
        description: "Test statement credit with clear source description.",
        amountCents: 1000,
        recurrence: "ANNUAL",
        merchantId: merchant.id,
        confidence: "MEDIUM",
      },
    });
    const badAmount = await server.inject({
      method: "POST",
      url: "/v1/admin/statement-credits",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        name: "Bad Credit",
        description: "Bad",
        amountCents: 0,
        recurrence: "ANNUAL",
        confidence: "MEDIUM",
      },
    });
    const badMerchant = await server.inject({
      method: "POST",
      url: "/v1/admin/statement-credits",
      headers: adminHeaders,
      payload: {
        cardId: card.id,
        name: "Bad Merchant Credit",
        description: "Bad",
        amountCents: 100,
        recurrence: "ANNUAL",
        merchantId: "missing",
        confidence: "MEDIUM",
      },
    });

    expect(benefit.statusCode).toBe(201);
    expect(badBenefit.statusCode).toBe(404);
    expect(credit.statusCode).toBe(201);
    expect(badAmount.statusCode).toBe(400);
    expect(badMerchant.statusCode).toBe(404);
    await server.close();
  });
});
