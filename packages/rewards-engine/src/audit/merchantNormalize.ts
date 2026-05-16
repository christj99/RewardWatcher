const aliases = new Map<string, string>([
  ["amzn", "amazon"],
  ["amzn mktp", "amazon"],
  ["amazon marketplace", "amazon"],
  ["wholefds", "whole foods"],
  ["whole fds", "whole foods"],
  ["uber trip", "uber"],
]);

const noiseWords = new Set(["pos", "debit", "purchase", "online"]);

export function normalizeMerchantName(raw: string): string {
  const lower = raw.toLowerCase().trim();
  const withoutStoreNumbers = lower
    .replace(/#\d+\b/g, " ")
    .replace(/\bstore\s+\d+\b/g, " ");
  const words = withoutStoreNumbers
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !noiseWords.has(word))
    .filter((word) => !/^\d+$/.test(word));
  const normalized = words.join(" ").trim();

  return applyAlias(normalized);
}

export function merchantNamesSimilar(a: string, b: string): boolean {
  return merchantNameSimilarityScore(a, b) >= 70;
}

export function merchantNameSimilarityScore(a: string, b: string): number {
  const normalizedA = normalizeMerchantName(a);
  const normalizedB = normalizeMerchantName(b);

  if (!normalizedA || !normalizedB) {
    return 0;
  }

  if (normalizedA === normalizedB) {
    return 100;
  }

  if (
    normalizedA.startsWith(normalizedB) ||
    normalizedB.startsWith(normalizedA)
  ) {
    return prefixScore(normalizedA, normalizedB);
  }

  const tokensA = new Set(normalizedA.split(" "));
  const tokensB = new Set(normalizedB.split(" "));
  const intersection = [...tokensA].filter((token) =>
    tokensB.has(token),
  ).length;
  const union = new Set([...tokensA, ...tokensB]).size;

  return Math.round((intersection / union) * 100);
}

function applyAlias(normalized: string): string {
  if (!normalized) {
    return normalized;
  }

  if (normalized.startsWith("uber eats")) {
    return "uber eats";
  }

  for (const [alias, canonical] of aliases.entries()) {
    if (normalized === alias || normalized.startsWith(`${alias} `)) {
      return canonical;
    }
  }

  if (normalized.startsWith("starbucks")) {
    return "starbucks";
  }

  return normalized;
}

function prefixScore(a: string, b: string): number {
  const shorter = Math.min(a.length, b.length);
  const longer = Math.max(a.length, b.length);
  return Math.max(70, Math.round((shorter / longer) * 100));
}
