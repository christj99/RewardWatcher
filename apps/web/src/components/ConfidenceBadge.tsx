import type { ConfidenceLevel } from "../api/types.js";

const labels: Record<ConfidenceLevel, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
  UNKNOWN: "Unknown confidence",
};

export function ConfidenceBadge({ level }: { level?: ConfidenceLevel | null }) {
  const value = level ?? "UNKNOWN";
  return (
    <span className={`badge confidence confidence-${value.toLowerCase()}`}>
      {labels[value]}
    </span>
  );
}
