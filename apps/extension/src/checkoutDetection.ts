import type { CheckoutDetectionResult, ConfidenceLevel } from "./types.js";

const strongUrlSignals = [
  "checkout",
  "payment",
  "cart",
  "basket",
  "order",
  "review",
  "place-order",
  "purchase",
];

const loginSignals = ["login", "signin", "sign-in", "account/login"];

const weakTextSignals = [
  "checkout",
  "payment",
  "order summary",
  "place order",
  "review order",
  "shipping",
  "billing",
  "pay now",
  "complete purchase",
];

const weakFormSignals = ["card", "payment", "billing"];
const weakButtonSignals = ["place order", "pay", "checkout"];

export function detectCheckoutContext(
  documentRef: Document,
  locationRef: Pick<Location, "href" | "pathname">,
): CheckoutDetectionResult {
  const href = locationRef.href.toLowerCase();
  const pathname = locationRef.pathname.toLowerCase();
  const reasons: string[] = [];

  if (loginSignals.some((signal) => href.includes(signal))) {
    return {
      isCheckoutLike: false,
      confidence: "LOW",
      reasons: ["Page appears to be a login or account page."],
    };
  }

  const urlSignals = strongUrlSignals.filter(
    (signal) => href.includes(signal) || pathname.includes(signal),
  );

  for (const signal of urlSignals) {
    reasons.push(`URL contains "${signal}".`);
  }

  const pageText = visibleText(documentRef).slice(0, 12000);
  const textMatches = weakTextSignals.filter((signal) =>
    pageText.includes(signal),
  );

  for (const signal of textMatches.slice(0, 4)) {
    reasons.push(`Page text includes "${signal}".`);
  }

  const formMatches = collectFormSignals(documentRef);
  reasons.push(...formMatches.slice(0, 4));

  const score =
    urlSignals.length * 3 +
    Math.min(textMatches.length, 4) +
    Math.min(formMatches.length, 4);
  const confidence = confidenceFromScore(score, urlSignals.length);

  return {
    isCheckoutLike: confidence === "HIGH" || confidence === "MEDIUM",
    confidence,
    reasons,
  };
}

export function detectPurchaseAmountCents(
  documentRef: Document,
): number | null {
  const text = visibleText(documentRef).replace(/\s+/g, " ");
  const totalPattern =
    /\b(?:order\s+total|estimated\s+total|grand\s+total|amount\s+due|total)\b[^$]{0,40}\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/gi;
  const matches = [...text.matchAll(totalPattern)]
    .map((match) => parseDollarAmount(match[1]))
    .filter((amount): amount is number => amount !== null);
  const uniqueMatches = [...new Set(matches)];

  if (uniqueMatches.length === 1) {
    return uniqueMatches[0] ?? null;
  }

  return null;
}

function confidenceFromScore(
  score: number,
  strongSignalCount: number,
): ConfidenceLevel {
  if (strongSignalCount > 0 && score >= 5) {
    return "HIGH";
  }

  if (strongSignalCount > 0 || score >= 3) {
    return "MEDIUM";
  }

  if (score > 0) {
    return "LOW";
  }

  return "UNKNOWN";
}

function visibleText(documentRef: Document): string {
  return (documentRef.body?.innerText ?? documentRef.body?.textContent ?? "")
    .toLowerCase()
    .trim();
}

function collectFormSignals(documentRef: Document): string[] {
  const signals: string[] = [];
  const inputs = Array.from(
    documentRef.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input, select, textarea",
    ),
  );

  for (const input of inputs.slice(0, 80)) {
    const haystack = [
      input.name,
      input.id,
      input.getAttribute("aria-label"),
      input.getAttribute("placeholder"),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const match = weakFormSignals.find((signal) => haystack.includes(signal));

    if (match) {
      signals.push(`Form field suggests "${match}".`);
    }
  }

  const buttons = Array.from(
    documentRef.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      "button, input[type='submit'], input[type='button']",
    ),
  );

  for (const button of buttons.slice(0, 40)) {
    const haystack = (
      button.textContent ??
      button.getAttribute("value") ??
      button.getAttribute("aria-label") ??
      ""
    ).toLowerCase();
    const match = weakButtonSignals.find((signal) => haystack.includes(signal));

    if (match) {
      signals.push(`Button suggests "${match}".`);
    }
  }

  return [...new Set(signals)];
}

function parseDollarAmount(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, "");
  const amount = Number.parseFloat(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
}
