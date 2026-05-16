import { compareConfidence } from "../confidence.js";
import { buildWeeklyActionText } from "./actionText.js";
import { buildConfidenceNotes } from "./confidenceSummary.js";
import type {
  WeeklyAuditItem,
  WeeklyAuditReport,
  WeeklyAuditReportInput,
} from "./weeklyReportTypes.js";

const defaultMinMissedValueCents = 100;
const defaultLimitItems = 50;

export function buildWeeklyAuditReport(
  input: WeeklyAuditReportInput,
): WeeklyAuditReport {
  const weekStart = new Date(input.weekStart);
  const weekEnd = new Date(input.weekEnd);
  const minMissedValueCents =
    input.minMissedValueCents ?? defaultMinMissedValueCents;
  const includeInconclusive = input.includeInconclusive ?? false;
  const includeUnmatched = input.includeUnmatched ?? true;
  const limitItems = input.limitItems ?? defaultLimitItems;
  const allItems = input.outcomes.map((outcome) => {
    const missedValueCents = cents(outcome.missedValueCents);
    const item = {
      ...outcome,
      transactionDate: new Date(outcome.transactionDate).toISOString(),
      capturedValueCents: nullableCents(outcome.capturedValueCents),
      missedValueCents: nullableCents(outcome.missedValueCents),
      expectedValueCents: nullableCents(outcome.expectedValueCents),
      isMeaningfulMiss: isMeaningfulMiss(
        outcome.outcomeType,
        missedValueCents,
        minMissedValueCents,
      ),
      warnings: outcome.warnings ?? [],
    } satisfies Omit<WeeklyAuditItem, "actionText">;

    return {
      ...item,
      actionText: buildWeeklyActionText(item, minMissedValueCents),
    };
  });
  const filteredItems = allItems
    .filter(
      (item) => includeInconclusive || item.outcomeType !== "INCONCLUSIVE",
    )
    .filter((item) => includeUnmatched || item.outcomeType !== "UNMATCHED")
    .sort(compareWeeklyItems)
    .slice(0, limitItems);
  const topMiss = selectTopMiss(allItems);
  const recommendationErrorCount = count(allItems, "RECOMMENDATION_ERROR");
  const inconclusiveCount = count(allItems, "INCONCLUSIVE");
  const capturedOptimalCount = count(allItems, "CAPTURED_OPTIMAL");
  const meaningfulMissedValueCents = allItems
    .filter((item) => item.isMeaningfulMiss)
    .reduce((sum, item) => sum + cents(item.missedValueCents), 0);

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    minMissedValueCents,
    totalTransactionsAudited: new Set(
      allItems.map((item) => item.transactionId),
    ).size,
    totalOutcomes: allItems.length,
    totalRecommendationsMatched: allItems.filter(
      (item) => item.recommendationEventId,
    ).length,
    estimatedValueCapturedCents: allItems.reduce(
      (sum, item) => sum + cents(item.capturedValueCents),
      0,
    ),
    estimatedValueMissedCents: allItems.reduce(
      (sum, item) => sum + cents(item.missedValueCents),
      0,
    ),
    meaningfulMissedValueCents,
    meaningfulMissCount: allItems.filter((item) => item.isMeaningfulMiss)
      .length,
    capturedOptimalCount,
    userMissedValueCount: count(allItems, "USER_MISSED_VALUE"),
    recommendationErrorCount,
    unmatchedCount: count(allItems, "UNMATCHED"),
    userOverrideCount: count(allItems, "USER_OVERRIDE"),
    inconclusiveCount,
    topMiss,
    recommendedAction: recommendedAction({
      topMiss,
      recommendationErrorCount,
      inconclusiveCount,
      capturedOptimalCount,
      meaningfulMissedValueCents,
    }),
    confidenceNotes: buildConfidenceNotes({
      items: allItems,
      recommendationErrorCount,
      inconclusiveCount,
    }),
    items: filteredItems,
  };
}

function isMeaningfulMiss(
  outcomeType: WeeklyAuditItem["outcomeType"],
  missedValueCents: number,
  minMissedValueCents: number,
): boolean {
  return (
    missedValueCents >= minMissedValueCents &&
    ["USER_MISSED_VALUE", "RECOMMENDATION_ERROR", "UNMATCHED"].includes(
      outcomeType,
    )
  );
}

function selectTopMiss(items: WeeklyAuditItem[]): WeeklyAuditItem | null {
  return (
    items
      .filter((item) => item.isMeaningfulMiss)
      .sort((a, b) => {
        const missedDelta =
          cents(b.missedValueCents) - cents(a.missedValueCents);
        if (missedDelta !== 0) {
          return missedDelta;
        }

        const confidenceDelta = compareConfidence(b.confidence, a.confidence);
        if (confidenceDelta !== 0) {
          return confidenceDelta;
        }

        const dateDelta =
          new Date(b.transactionDate).getTime() -
          new Date(a.transactionDate).getTime();
        if (dateDelta !== 0) {
          return dateDelta;
        }

        return a.outcomeId.localeCompare(b.outcomeId);
      })[0] ?? null
  );
}

function compareWeeklyItems(a: WeeklyAuditItem, b: WeeklyAuditItem): number {
  const groupDelta = itemGroup(a) - itemGroup(b);
  if (groupDelta !== 0) {
    return groupDelta;
  }

  const dateDelta =
    new Date(b.transactionDate).getTime() -
    new Date(a.transactionDate).getTime();
  if (dateDelta !== 0) {
    return dateDelta;
  }

  const missedDelta = cents(b.missedValueCents) - cents(a.missedValueCents);
  if (missedDelta !== 0) {
    return missedDelta;
  }

  return a.outcomeId.localeCompare(b.outcomeId);
}

function itemGroup(item: WeeklyAuditItem): number {
  if (item.isMeaningfulMiss && item.outcomeType !== "RECOMMENDATION_ERROR") {
    return 0;
  }

  if (item.outcomeType === "RECOMMENDATION_ERROR") {
    return 1;
  }

  if (item.outcomeType === "CAPTURED_OPTIMAL") {
    return 2;
  }

  if (item.outcomeType === "UNMATCHED") {
    return 3;
  }

  if (item.outcomeType === "USER_OVERRIDE") {
    return 4;
  }

  return 5;
}

function recommendedAction(input: {
  topMiss: WeeklyAuditItem | null;
  recommendationErrorCount: number;
  inconclusiveCount: number;
  capturedOptimalCount: number;
  meaningfulMissedValueCents: number;
}): string {
  if (input.topMiss) {
    return input.topMiss.actionText;
  }

  if (input.recommendationErrorCount > 0) {
    return "We found at least one recommendation that may need review. Check the correction status before relying on similar merchants.";
  }

  if (input.inconclusiveCount > 0 && input.meaningfulMissedValueCents === 0) {
    return "Add the card used or merchant category for inconclusive transactions so future audits can be more accurate.";
  }

  if (input.capturedOptimalCount > 0) {
    return "You appear to be using strong cards for the audited transactions this week.";
  }

  return "Import more transactions or request recommendations before purchases to generate a useful audit.";
}

function count(
  items: WeeklyAuditItem[],
  outcomeType: WeeklyAuditItem["outcomeType"],
): number {
  return items.filter((item) => item.outcomeType === outcomeType).length;
}

function cents(value: number | null | undefined): number {
  return value === null || value === undefined ? 0 : Math.round(value);
}

function nullableCents(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : Math.round(value);
}
