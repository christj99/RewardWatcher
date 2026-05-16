export function ConfidenceBadge({ value }: { value?: string | null }) {
  const label = value ?? "UNKNOWN";
  return (
    <span className={`badge confidence-${label.toLowerCase()}`}>{label}</span>
  );
}
