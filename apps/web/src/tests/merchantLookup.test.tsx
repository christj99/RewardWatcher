import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../api/client.js";
import { MerchantLookupPage } from "../pages/MerchantLookupPage.js";

vi.mock("../api/client.js", () => ({
  apiClient: {
    searchMerchants: vi.fn(),
    getMerchantByUrl: vi.fn(),
    createRecommendation: vi.fn(),
  },
}));

const mockedApi = vi.mocked(apiClient);

describe("merchant lookup page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.searchMerchants.mockResolvedValue([merchant()]);
    mockedApi.createRecommendation.mockResolvedValue(recommendation());
  });

  it("requires merchant input before submit", async () => {
    render(
      <MemoryRouter>
        <MerchantLookupPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Get recommendation" }));

    expect(
      await screen.findByText(
        "Choose a merchant, enter a merchant URL, or type a merchant name.",
      ),
    ).toBeInTheDocument();
  });

  it("converts dollar amount to cents and shows receipt link", async () => {
    render(
      <MemoryRouter>
        <MerchantLookupPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Merchant name fallback"), {
      target: { value: "Starbucks" },
    });
    fireEvent.change(screen.getByLabelText("Purchase amount"), {
      target: { value: "50.00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get recommendation" }));

    await waitFor(() =>
      expect(mockedApi.createRecommendation).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantName: "Starbucks",
          purchaseAmountCents: 5000,
        }),
      ),
    );
    expect(
      await screen.findByText("American Express Gold Card is recommended"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open saved receipt" }),
    ).toHaveAttribute("href", "/recommendations/rec-1");
  });
});

function merchant() {
  return {
    id: "merchant-1",
    name: "Starbucks",
    slug: "starbucks",
    category: "DINING" as const,
    websiteUrl: "https://www.starbucks.com",
  };
}

function recommendation() {
  return {
    id: "rec-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    merchant: merchant(),
    purchaseAmountCents: 5000,
    context: "MANUAL_LOOKUP" as const,
    lens: "PRACTICAL" as const,
    expectedCategory: "DINING" as const,
    expectedValueCents: "320",
    confidence: "HIGH" as const,
    explanation:
      "American Express Gold Card is recommended because Starbucks is dining.",
    primaryRecommendation: {
      rank: 1,
      userCardId: "user-card-1",
      cardId: "card-1",
      cardName: "American Express Gold Card",
      issuerName: "American Express",
      expectedValueCents: "320",
      confidence: "HIGH" as const,
    },
    alternatives: [],
    warnings: [],
  };
}
