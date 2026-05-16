import type {
  WeeklyAuditItem,
  WeeklyAuditOutcomeInput,
} from "./weeklyReportTypes.js";

export function buildWeeklyActionText(
  item: WeeklyAuditOutcomeInput | WeeklyAuditItem,
  minMissedValueCents = 100,
): string {
  const actualCard = item.actualCard?.name ?? "the card you used";
  const bestCard = item.bestCard?.name ?? "the best available card";
  const merchantName = item.merchantName || "this merchant";
  const missedValueCents = item.missedValueCents ?? 0;

  switch (item.outcomeType) {
    case "CAPTURED_OPTIMAL":
      return `Keep using ${actualCard} for ${merchantName} when it posts this way.`;
    case "USER_MISSED_VALUE":
      return `Use ${bestCard} instead of ${actualCard} for similar ${merchantName} transactions next time.`;
    case "RECOMMENDATION_ERROR":
      return `We may need to correct this merchant or rule. Review ${merchantName} before relying on the same recommendation again.`;
    case "UNMATCHED":
      return missedValueCents >= minMissedValueCents
        ? `You may want to use ${bestCard} for similar ${merchantName} transactions.`
        : "No prior recommendation was matched, but your card choice appears close to optimal.";
    case "USER_OVERRIDE":
      return "This looks like a personal preference or intentional override. Keep using your preferred card if the tradeoff is worth it.";
    case "INCONCLUSIVE":
      return "Add the card used or merchant category so this transaction can be audited more confidently.";
  }
}
