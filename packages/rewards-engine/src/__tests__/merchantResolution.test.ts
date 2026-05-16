import { describe, expect, it } from "vitest";

import { InMemoryRewardsEngineRepository } from "../fixtures.js";
import {
  normalizeMerchantUrl,
  resolveExpectedCategory,
  resolveMerchant,
} from "../merchantResolution.js";

describe("merchant resolution", () => {
  it("resolves merchant by id", async () => {
    const repository = new InMemoryRewardsEngineRepository();
    const merchant = await resolveMerchant(
      { userId: "user-1", merchantId: "merchant-dining" },
      repository,
    );

    expect(merchant).toMatchObject({
      id: "merchant-dining",
      category: "DINING",
      resolutionMethod: "ID",
      confidence: "HIGH",
    });
  });

  it("resolves merchant by URL", async () => {
    const repository = new InMemoryRewardsEngineRepository();
    const merchant = await resolveMerchant(
      {
        userId: "user-1",
        merchantUrl: "https://www.wholefoodsmarket.com/shop",
      },
      repository,
    );

    expect(merchant).toMatchObject({
      id: "merchant-grocery",
      category: "GROCERY",
      resolutionMethod: "URL",
    });
  });

  it("resolves merchant by name", async () => {
    const repository = new InMemoryRewardsEngineRepository();
    const merchant = await resolveMerchant(
      { userId: "user-1", merchantName: "Local Restaurant" },
      repository,
    );

    expect(merchant.id).toBe("merchant-dining");
    expect(merchant.resolutionMethod).toBe("NAME");
  });

  it("handles invalid URL without crashing", async () => {
    const repository = new InMemoryRewardsEngineRepository();
    const merchant = await resolveMerchant(
      { userId: "user-1", merchantUrl: "not a url" },
      repository,
    );

    expect(normalizeMerchantUrl("not a url")).toBeNull();
    expect(merchant.category).toBe("UNKNOWN");
    expect(merchant.warnings[0]).toContain("could not be parsed");
  });

  it("returns UNKNOWN category and warning for unknown merchant", async () => {
    const repository = new InMemoryRewardsEngineRepository();
    const merchant = await resolveMerchant({ userId: "user-1" }, repository);

    expect(merchant.category).toBe("UNKNOWN");
    expect(merchant.warnings).toHaveLength(1);
  });

  it("prefers higher confidence posting profile and warns on category disagreement", () => {
    const category = resolveExpectedCategory(
      {
        id: "merchant-general",
        name: "Target",
        category: "GENERAL",
        confidence: "HIGH",
        resolutionMethod: "ID",
        warnings: [],
      },
      [
        {
          id: "posting-low",
          merchantId: "merchant-general",
          observedCategory: "OTHER",
          confidence: "LOW",
        },
        {
          id: "posting-high",
          merchantId: "merchant-general",
          observedCategory: "GROCERY",
          confidence: "HIGH",
        },
      ],
    );

    expect(category.category).toBe("GROCERY");
    expect(category.postingProfileId).toBe("posting-high");
    expect(category.warnings[0]).toContain("differs");
  });
});
