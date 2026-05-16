import { describe, expect, it, vi } from "vitest";

import {
  removeRecommendationOverlay,
  renderRecommendationOverlay,
} from "../overlay.js";

describe("recommendation overlay", () => {
  it("renders recommendation details and the receipt link", () => {
    renderRecommendationOverlay({
      receiptId: "rec_1",
      cardName: "American Express Gold Card",
      issuerName: "American Express",
      explanation: "This card earns 4x for dining.",
      confidence: "HIGH",
      expectedValueCents: 640,
      warnings: ["This rule may require activation."],
      receiptUrl: "http://localhost:5173/recommendations/rec_1",
      feedbackUrl:
        "http://localhost:5173/feedback?recommendationId=rec_1&type=WRONG_RECOMMENDATION",
      onDismiss: vi.fn(),
    });
    const host = document.getElementById("rewards-audit-checkout-overlay");
    const text = host?.shadowRoot?.textContent ?? "";
    const link = host?.shadowRoot?.querySelector<HTMLAnchorElement>("a");

    expect(text).toContain("American Express Gold Card");
    expect(text).toContain("HIGH");
    expect(text).toContain("$6.40");
    expect(text).toContain("This rule may require activation.");
    expect(text).toContain(
      "Ranked by expected value, not sponsored placement.",
    );
    expect(link?.href).toBe("http://localhost:5173/recommendations/rec_1");
    expect(text).toContain("Report issue");
  });

  it("dismiss button calls callback and removes the overlay", () => {
    const onDismiss = vi.fn();
    renderRecommendationOverlay({
      receiptId: "rec_1",
      cardName: "Chase Sapphire Preferred",
      explanation: "This card earns well for travel.",
      confidence: "MEDIUM",
      warnings: [],
      receiptUrl: "http://localhost:5173/recommendations/rec_1",
      onDismiss,
    });

    document
      .getElementById("rewards-audit-checkout-overlay")
      ?.shadowRoot?.querySelector<HTMLButtonElement>(".ra-close")
      ?.click();

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(
      document.getElementById("rewards-audit-checkout-overlay"),
    ).toBeNull();
  });

  it("deduplicates repeated warnings before rendering", () => {
    renderRecommendationOverlay({
      receiptId: "rec_1",
      cardName: "Capital One Venture X",
      explanation: "This card earns 2x everywhere.",
      confidence: "MEDIUM",
      warnings: [
        "Currency valuation confidence is not HIGH.",
        "Currency valuation confidence is not HIGH.",
        " currency valuation confidence is not high. ",
        "",
      ],
      receiptUrl: "http://localhost:5173/recommendations/rec_1",
      onDismiss: vi.fn(),
    });

    const warnings = document
      .getElementById("rewards-audit-checkout-overlay")
      ?.shadowRoot?.querySelectorAll(".ra-warning");

    expect(warnings).toHaveLength(1);
    expect(warnings?.[0]?.textContent).toBe(
      "Currency valuation confidence is not HIGH.",
    );
  });

  it("can expand why details", () => {
    renderRecommendationOverlay({
      receiptId: "rec_1",
      cardName: "Capital One Venture X",
      explanation: "This card earns 2x everywhere.",
      confidence: "LOW",
      warnings: [],
      receiptUrl: "http://localhost:5173/recommendations/rec_1",
      onDismiss: vi.fn(),
    });
    const details = document
      .getElementById("rewards-audit-checkout-overlay")
      ?.shadowRoot?.querySelector<HTMLDetailsElement>("details");

    expect(details).toBeDefined();
    details?.setAttribute("open", "");
    expect(details?.open).toBe(true);
    removeRecommendationOverlay();
  });
});
