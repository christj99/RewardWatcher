import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../api/client.js";
import { OffersPage } from "../pages/OffersPage.js";

vi.mock("../api/client.js", () => ({
  apiClient: {
    getOffers: vi.fn(),
    updateOfferActivation: vi.fn(),
  },
}));

const mockedApi = vi.mocked(apiClient);

describe("offers page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getOffers.mockResolvedValue([offer()]);
    mockedApi.updateOfferActivation.mockResolvedValue({ status: "ACTIVATED" });
  });

  it("renders relevant offers and activates/dismisses them", async () => {
    render(
      <MemoryRouter>
        <OffersPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Amex Gold Uber Eats offer"),
    ).toBeInTheDocument();
    expect(screen.getByText("$10.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark activated" }));
    await waitFor(() =>
      expect(mockedApi.updateOfferActivation).toHaveBeenCalledWith(
        "offer-1",
        expect.objectContaining({ status: "ACTIVATED" }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() =>
      expect(mockedApi.updateOfferActivation).toHaveBeenCalledWith(
        "offer-1",
        expect.objectContaining({ status: "DISMISSED" }),
      ),
    );
  });

  it("shows the empty offers state", async () => {
    mockedApi.getOffers.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <OffersPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("No relevant offers yet"),
    ).toBeInTheDocument();
  });
});

function offer() {
  return {
    offer: {
      id: "offer-1",
      title: "Amex Gold Uber Eats offer",
      description: "Spend at Uber Eats and receive a statement credit.",
      offerType: "STATEMENT_CREDIT" as const,
      valueCents: 1000,
      bonusPoints: null,
      bonusCurrency: null,
      bonusMultiplier: null,
      minSpendCents: 1500,
      maxRewardCents: 1000,
      activationRequired: true,
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-12-31T00:00:00.000Z",
      confidence: "MEDIUM" as const,
      issuer: {
        id: "issuer-1",
        name: "American Express",
        slug: "american-express",
      },
      card: {
        id: "card-1",
        name: "American Express Gold Card",
        slug: "amex-gold",
      },
      merchant: {
        id: "merchant-1",
        name: "Uber Eats",
        slug: "uber-eats",
        category: "DINING" as const,
      },
      category: null,
    },
    userActivation: {
      status: "AVAILABLE" as const,
      userCardId: "user-card-1",
      activatedAt: null,
      usedAt: null,
      dismissedAt: null,
      expiresAt: null,
    },
    relevance: {
      matchingUserCards: [
        {
          id: "user-card-1",
          cardId: "card-1",
          cardName: "American Express Gold Card",
          issuerName: "American Express",
        },
      ],
      reason: "Eligible wallet card",
    },
  };
}
