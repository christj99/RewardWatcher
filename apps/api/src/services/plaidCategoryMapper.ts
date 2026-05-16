import type { MerchantCategory } from "@prisma/client";

export type PlaidCategoryInput = {
  personal_finance_category?:
    | {
        primary?: string | null | undefined;
        detailed?: string | null | undefined;
      }
    | null
    | undefined;
  category?: string[] | null | undefined;
};

export function mapPlaidTransactionToMerchantCategory(
  transaction: PlaidCategoryInput,
): MerchantCategory | null {
  const values = [
    transaction.personal_finance_category?.primary,
    transaction.personal_finance_category?.detailed,
    ...(transaction.category ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().replaceAll("_", " "));

  const text = values.join(" ");

  if (matches(text, ["grocery", "groceries", "supermarket"])) {
    return "GROCERY";
  }
  if (matches(text, ["restaurant", "food and drink", "coffee", "bar"])) {
    return "DINING";
  }
  if (matches(text, ["flight", "airline", "air travel"])) {
    return "AIRFARE";
  }
  if (matches(text, ["hotel", "lodging"])) {
    return "HOTEL";
  }
  if (matches(text, ["taxi", "rideshare", "ride share"])) {
    return "RIDESHARE";
  }
  if (matches(text, ["gas", "fuel"])) {
    return "GAS";
  }
  if (matches(text, ["pharmacy", "drugstore"])) {
    return "DRUGSTORE";
  }
  if (matches(text, ["online marketplace", "e-commerce", "shopping"])) {
    return "ONLINE_RETAIL";
  }
  if (matches(text, ["travel"])) {
    return "TRAVEL";
  }

  return null;
}

function matches(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}
