export function normalizeUrlForLookup(url: string): string | null {
  const trimmed = url.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return null;
    }
  }
}

export function normalizedHost(url: string): string | null {
  const normalized = normalizeUrlForLookup(url);

  if (!normalized) {
    return null;
  }

  return new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
}

export function pageDismissalKey(url: string): string {
  const normalized = normalizeUrlForLookup(url);

  if (!normalized) {
    return url.trim().toLowerCase();
  }

  const parsed = new URL(normalized);
  return `${parsed.hostname.toLowerCase()}${parsed.pathname}`;
}
