import type { OutcomeType } from "../api/types.js";

const labels: Record<OutcomeType, string> = {
  CAPTURED_OPTIMAL: "Captured optimal",
  USER_MISSED_VALUE: "Missed value",
  RECOMMENDATION_ERROR: "Recommendation error",
  UNMATCHED: "Unmatched",
  USER_OVERRIDE: "User override",
  INCONCLUSIVE: "Inconclusive",
};

export function OutcomeBadge({
  type,
}: {
  type?: OutcomeType | null | undefined;
}) {
  if (!type) {
    return <span className="badge">No outcome</span>;
  }
  return (
    <span className={`badge outcome outcome-${type.toLowerCase()}`}>
      {labels[type]}
    </span>
  );
}
