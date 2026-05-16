import { beforeEach, describe, expect, it } from "vitest";

import {
  clearExtensionStorageForTests,
  dismissPage,
  isMerchantMuted,
  isPageDismissed,
  muteMerchant,
} from "../storage.js";

describe("extension storage", () => {
  beforeEach(async () => {
    await clearExtensionStorageForTests();
  });

  it("can dismiss a page", async () => {
    await dismissPage("https://www.amazon.com/checkout");

    await expect(
      isPageDismissed("https://www.amazon.com/checkout"),
    ).resolves.toBe(true);
  });

  it("can mute a merchant", async () => {
    await muteMerchant("merchant_1");

    await expect(isMerchantMuted("merchant_1")).resolves.toBe(true);
    await expect(isMerchantMuted("merchant_2")).resolves.toBe(false);
  });
});
