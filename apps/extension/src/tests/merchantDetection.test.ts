import { describe, expect, it, vi } from "vitest";

import { resolveMerchantForPage } from "../merchantDetection.js";

describe("merchant detection", () => {
  it("normalizes page URLs before resolving", async () => {
    const resolver = {
      resolveMerchantByUrl: vi.fn(async () => ({
        merchant: {
          id: "merchant_1",
          name: "Amazon",
          slug: "amazon",
          category: "ONLINE_RETAIL",
        },
        confidence: "HIGH" as const,
      })),
    };

    const result = await resolveMerchantForPage(
      "amazon.com/checkout",
      resolver,
    );

    expect(result?.merchant.name).toBe("Amazon");
    expect(resolver.resolveMerchantByUrl).toHaveBeenCalledWith(
      "https://amazon.com/checkout",
    );
  });

  it("returns null when backend resolution fails", async () => {
    const resolver = {
      resolveMerchantByUrl: vi.fn(async () => {
        throw new Error("not found");
      }),
    };

    await expect(
      resolveMerchantForPage("https://unknown.test", resolver),
    ).resolves.toBeNull();
  });
});
