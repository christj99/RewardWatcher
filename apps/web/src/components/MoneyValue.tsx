export function MoneyValue({
  cents,
}: {
  cents?: number | string | null | undefined;
}) {
  return <span>{formatCents(cents)}</span>;
}

export function formatCents(cents?: number | string | null): string {
  if (cents === null || cents === undefined || cents === "") {
    return "Not available";
  }
  const numeric = typeof cents === "string" ? Number(cents) : cents;
  if (!Number.isFinite(numeric)) {
    return "Not available";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numeric / 100);
}

export function dollarsToCents(value: string): number | null {
  const trimmed = value.trim().replace(/^\$/, "");
  if (!trimmed) {
    return null;
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.round(numeric * 100);
}
