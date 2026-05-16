export function StatusBadge({ value }: { value?: string | boolean | null }) {
  const label =
    typeof value === "boolean"
      ? value
        ? "Active"
        : "Inactive"
      : value || "Unknown";
  return <span className="badge">{String(label).replaceAll("_", " ")}</span>;
}
