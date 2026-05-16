import type { WeeklyAuditItem } from "./weeklyReportTypes.js";

export function buildConfidenceNotes(input: {
  items: WeeklyAuditItem[];
  recommendationErrorCount: number;
  inconclusiveCount: number;
}): string[] {
  const notes: string[] = [];

  if (input.items.some((item) => item.confidence === "LOW")) {
    notes.push(
      "Some outcomes rely on low-confidence data; review those before changing habits.",
    );
  }

  if (input.items.some((item) => item.confidence === "UNKNOWN")) {
    notes.push(
      "Some outcomes have unknown confidence because card or merchant data was incomplete.",
    );
  }

  if (input.recommendationErrorCount > 0) {
    notes.push(
      "At least one recommendation error was detected; corrections can improve future audits.",
    );
  }

  if (input.inconclusiveCount > 0) {
    notes.push(
      "Some outcomes were inconclusive because card or merchant data was missing.",
    );
  }

  return notes.length > 0
    ? notes
    : ["Audited outcomes had sufficient confidence for this summary."];
}
