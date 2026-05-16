import { afterEach, describe, expect, it, vi } from "vitest";

import { checkoutApiClient } from "../runtimeApiClient.js";

type TestChromeGlobal = typeof globalThis & {
  chrome?: {
    runtime?: {
      sendMessage: ReturnType<typeof vi.fn>;
    };
  };
};

describe("extension runtime API client", () => {
  afterEach(() => {
    delete (globalThis as TestChromeGlobal).chrome;
  });

  it("proxies merchant resolution through the extension runtime", async () => {
    const sendMessage = vi.fn(async () => ({
      ok: true,
      data: {
        merchant: {
          id: "merchant_target",
          name: "Target",
          slug: "target",
          category: "GENERAL",
        },
        confidence: "HIGH",
      },
    }));
    (globalThis as TestChromeGlobal).chrome = {
      runtime: { sendMessage },
    };

    await checkoutApiClient.resolveMerchantByUrl(
      "https://www.target.com/checkout",
    );

    expect(sendMessage).toHaveBeenCalledWith({
      type: "RA_RESOLVE_MERCHANT_BY_URL",
      url: "https://www.target.com/checkout",
    });
  });

  it("proxies checkout recommendations through the extension runtime", async () => {
    const sendMessage = vi.fn(async () => ({
      ok: true,
      data: { id: "rec_1" },
    }));
    (globalThis as TestChromeGlobal).chrome = {
      runtime: { sendMessage },
    };

    await checkoutApiClient.createCheckoutRecommendation({
      merchantUrl: "https://www.target.com/checkout",
      purchaseAmountCents: 2295,
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: "RA_CREATE_CHECKOUT_RECOMMENDATION",
      input: {
        merchantUrl: "https://www.target.com/checkout",
        purchaseAmountCents: 2295,
      },
    });
  });

  it("surfaces background errors without crashing the page", async () => {
    const sendMessage = vi.fn(async () => ({
      ok: false,
      error: "No current user",
      status: 401,
    }));
    (globalThis as TestChromeGlobal).chrome = {
      runtime: { sendMessage },
    };

    await expect(
      checkoutApiClient.resolveMerchantByUrl("https://www.target.com/checkout"),
    ).rejects.toThrow("No current user");
  });

  it("fails clearly if the extension runtime is unavailable", async () => {
    await expect(
      checkoutApiClient.resolveMerchantByUrl("https://www.target.com/checkout"),
    ).rejects.toThrow("Extension runtime is unavailable.");
  });
});
