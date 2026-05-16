import { describe, expect, it } from "vitest";

import {
  merchantNameSimilarityScore,
  normalizeMerchantName,
} from "../merchantNormalize.js";

describe("merchant normalization", () => {
  it("normalizes case and punctuation", () => {
    expect(normalizeMerchantName("  Starbucks!!! Online ")).toBe("starbucks");
  });

  it("strips store numbers", () => {
    expect(normalizeMerchantName("STARBUCKS STORE #1234")).toBe("starbucks");
  });

  it("handles amazon aliases", () => {
    expect(normalizeMerchantName("AMZN Mktp US*ABC123")).toBe("amazon");
  });

  it("distinguishes Uber and Uber Eats where possible", () => {
    expect(normalizeMerchantName("UBER *TRIP HELP.UBER.COM")).toBe("uber");
    expect(normalizeMerchantName("UBER EATS HELP.UBER.COM")).toBe("uber eats");
  });

  it("similarity score is deterministic", () => {
    expect(merchantNameSimilarityScore("AMZN Mktp", "Amazon")).toBe(
      merchantNameSimilarityScore("AMZN Mktp", "Amazon"),
    );
  });
});
