import type { KillTestMetrics } from "./killTestTypes.js";

export function formatKillTestSummary(metrics: KillTestMetrics): string[] {
  return [
    `Users evaluated: ${metrics.totalUsersEvaluated}`,
    `Users with meaningful miss: ${metrics.usersWithMeaningfulMiss} (${formatPercent(
      metrics.percentUsersWithMeaningfulMiss,
    )})`,
    `Meaningful missed value: ${formatDollars(
      metrics.totalMeaningfulMissedValueCents,
    )}`,
    `Users above subscription value: ${metrics.usersAboveSubscriptionValue}`,
    `Recommendation error rate: ${formatPercent(
      metrics.recommendationErrorRate * 100,
    )}`,
    `Inconclusive rate: ${formatPercent(metrics.inconclusiveRate * 100)}`,
    `Overall pass: ${metrics.passFail.overallPass ? "YES" : "NO"}`,
    "Reasons:",
    ...metrics.passFail.reasons.map((reason) => `- ${reason}`),
  ];
}

export function formatDollars(valueCents: number): string {
  return `$${(valueCents / 100).toFixed(2)}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
