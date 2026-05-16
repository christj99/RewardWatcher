import type { Merchant } from "../api/types.js";

export function MerchantSummary({
  merchant,
}: {
  merchant?: Merchant | null | undefined;
}) {
  if (!merchant) {
    return <span>Unknown merchant</span>;
  }
  return (
    <span>
      {merchant.name}{" "}
      <span className="muted">({merchant.category.replace("_", " ")})</span>
    </span>
  );
}
