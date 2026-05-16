import type { ConfidenceLevel } from "./types.js";

const confidenceRank: Record<ConfidenceLevel, number> = {
  UNKNOWN: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

const confidenceByRank: Record<number, ConfidenceLevel> = {
  0: "UNKNOWN",
  1: "LOW",
  2: "MEDIUM",
  3: "HIGH",
};

export function compareConfidence(
  a: ConfidenceLevel,
  b: ConfidenceLevel,
): number {
  return confidenceRank[a] - confidenceRank[b];
}

export function downgradeConfidence(
  level: ConfidenceLevel,
  steps = 1,
): ConfidenceLevel {
  const nextRank = Math.max(0, confidenceRank[level] - steps);
  return confidenceByRank[nextRank] ?? "UNKNOWN";
}

export function combineConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) {
    return "UNKNOWN";
  }

  if (levels.includes("UNKNOWN")) {
    return "UNKNOWN";
  }

  if (levels.includes("LOW")) {
    return "LOW";
  }

  if (levels.includes("MEDIUM")) {
    return "MEDIUM";
  }

  return "HIGH";
}
