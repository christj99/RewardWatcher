import overlayCss from "./overlay.css?inline";
import type { OverlayRecommendation } from "./types.js";

const overlayHostId = "rewards-audit-checkout-overlay";

export function renderRecommendationOverlay(
  recommendation: OverlayRecommendation,
  documentRef: Document = document,
): HTMLElement {
  removeRecommendationOverlay(documentRef);

  const host = documentRef.createElement("div");
  host.id = overlayHostId;
  const shadowRoot = host.attachShadow({ mode: "open" });
  const style = documentRef.createElement("style");
  style.textContent = overlayCss;
  shadowRoot.append(style, buildOverlay(recommendation, documentRef));
  documentRef.body.append(host);
  return host;
}

export function removeRecommendationOverlay(
  documentRef: Document = document,
): void {
  documentRef.getElementById(overlayHostId)?.remove();
}

function buildOverlay(
  recommendation: OverlayRecommendation,
  documentRef: Document,
): HTMLElement {
  const overlay = documentRef.createElement("aside");
  overlay.className = "ra-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Rewards Audit card recommendation");

  const header = documentRef.createElement("div");
  header.className = "ra-header";

  const heading = documentRef.createElement("div");
  heading.append(
    textElement(documentRef, "p", "ra-eyebrow", "Rewards Audit"),
    textElement(documentRef, "h2", "ra-title", recommendation.cardName),
    textElement(documentRef, "p", "ra-subtitle", recommendation.issuerName),
  );

  const closeButton = documentRef.createElement("button");
  closeButton.className = "ra-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Dismiss recommendation");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => {
    recommendation.onDismiss();
    removeRecommendationOverlay(documentRef);
  });

  header.append(heading, closeButton);

  const body = documentRef.createElement("div");
  body.className = "ra-body";
  body.append(
    section(documentRef, "Why this card", recommendation.explanation),
    badgeRow(
      documentRef,
      "Confidence",
      recommendation.confidence,
      recommendation.expectedValueCents,
    ),
  );

  const warningsToRender = uniqueWarnings(recommendation.warnings);

  if (warningsToRender.length > 0) {
    const warnings = documentRef.createElement("div");
    warnings.className = "ra-section";
    warnings.append(textElement(documentRef, "p", "ra-label", "Warnings"));
    for (const warning of warningsToRender) {
      warnings.append(textElement(documentRef, "p", "ra-warning", warning));
    }
    body.append(warnings);
  }

  const details = documentRef.createElement("details");
  details.className = "ra-details";
  const summary = documentRef.createElement("summary");
  summary.textContent = "Why?";
  details.append(
    summary,
    textElement(
      documentRef,
      "p",
      "ra-disclosure",
      "Ranked by expected value, not sponsored placement.",
    ),
  );
  body.append(details);

  const footer = documentRef.createElement("div");
  footer.className = "ra-footer";
  const receiptLink = documentRef.createElement("a");
  receiptLink.className = "ra-link";
  receiptLink.href = recommendation.receiptUrl;
  receiptLink.target = "_blank";
  receiptLink.rel = "noreferrer";
  receiptLink.textContent = "View receipt";
  footer.append(receiptLink);

  if (recommendation.feedbackUrl) {
    const feedbackLink = documentRef.createElement("a");
    feedbackLink.className = "ra-link";
    feedbackLink.href = recommendation.feedbackUrl;
    feedbackLink.target = "_blank";
    feedbackLink.rel = "noreferrer";
    feedbackLink.textContent = "Report issue";
    footer.append(feedbackLink);
  }

  if (recommendation.onMuteMerchant) {
    const muteButton = documentRef.createElement("button");
    muteButton.className = "ra-secondary";
    muteButton.type = "button";
    muteButton.textContent = "Don't show for this merchant";
    muteButton.addEventListener("click", () => {
      recommendation.onMuteMerchant?.();
      removeRecommendationOverlay(documentRef);
    });
    footer.append(muteButton);
  }

  overlay.append(header, body, footer);
  return overlay;
}

function section(documentRef: Document, label: string, value: string) {
  const wrapper = documentRef.createElement("div");
  wrapper.className = "ra-section";
  wrapper.append(
    textElement(documentRef, "p", "ra-label", label),
    textElement(documentRef, "p", "ra-value", value),
  );
  return wrapper;
}

function badgeRow(
  documentRef: Document,
  label: string,
  confidence: string,
  expectedValueCents?: number | null,
) {
  const wrapper = documentRef.createElement("div");
  wrapper.className = "ra-section";
  const row = documentRef.createElement("div");
  row.className = "ra-row";
  row.append(textElement(documentRef, "span", "ra-badge", confidence));

  if (expectedValueCents !== undefined && expectedValueCents !== null) {
    row.append(
      textElement(
        documentRef,
        "span",
        "ra-badge",
        `Expected ${formatCents(expectedValueCents)}`,
      ),
    );
  }

  wrapper.append(textElement(documentRef, "p", "ra-label", label), row);
  return wrapper;
}

function textElement<K extends keyof HTMLElementTagNameMap>(
  documentRef: Document,
  tagName: K,
  className: string,
  text: string | undefined,
): HTMLElementTagNameMap[K] {
  const element = documentRef.createElement(tagName);
  element.className = className;
  element.textContent = text ?? "";
  return element;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function uniqueWarnings(warnings: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const warning of warnings) {
    const trimmed = warning.trim();
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}
