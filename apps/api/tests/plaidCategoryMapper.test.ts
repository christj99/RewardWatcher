import { describe, expect, it } from "vitest";

import { mapPlaidTransactionToMerchantCategory } from "../src/services/plaidCategoryMapper.js";

describe("Plaid category mapper", () => {
  it("maps dining categories", () => {
    expect(
      mapPlaidTransactionToMerchantCategory({
        category: ["Food and Drink", "Restaurants"],
      }),
    ).toBe("DINING");
  });

  it("maps grocery categories", () => {
    expect(
      mapPlaidTransactionToMerchantCategory({
        personal_finance_category: {
          primary: "FOOD_AND_DRINK",
          detailed: "FOOD_AND_DRINK_GROCERIES",
        },
      }),
    ).toBe("GROCERY");
  });

  it("returns null for unknown categories", () => {
    expect(
      mapPlaidTransactionToMerchantCategory({ category: ["Transfer"] }),
    ).toBeNull();
  });
});
