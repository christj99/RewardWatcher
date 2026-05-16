import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../api/client.js";
import { ApiError } from "../api/errors.js";
import { WalletPage } from "../pages/WalletPage.js";

vi.mock("../api/client.js", () => ({
  apiClient: {
    getWallet: vi.fn(),
    listCards: vi.fn(),
    addWalletCard: vi.fn(),
    updateWalletCard: vi.fn(),
    deleteWalletCard: vi.fn(),
  },
}));

const mockedApi = vi.mocked(apiClient);

describe("wallet page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getWallet.mockResolvedValue([walletCard()]);
    mockedApi.listCards.mockResolvedValue([card()]);
    mockedApi.addWalletCard.mockResolvedValue(walletCard());
  });

  it("renders wallet cards from the API", async () => {
    render(
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("American Express Gold Card"),
    ).toBeInTheDocument();
    expect(screen.getByText("American Express")).toBeInTheDocument();
  });

  it("add card form calls addWalletCard", async () => {
    render(
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Search cards"), {
      target: { value: "gold" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(mockedApi.addWalletCard).toHaveBeenCalledWith({
        cardId: "card-1",
      }),
    );
  });

  it("shows duplicate card errors and validates annual fee month", async () => {
    mockedApi.addWalletCard.mockRejectedValue(new ApiError("Duplicate", 409));
    render(
      <MemoryRouter>
        <WalletPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Search" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    expect(
      await screen.findByText("This card is already in your wallet."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Annual fee month"), {
      target: { value: "13" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Annual fee due month must be between 1 and 12."),
    ).toBeInTheDocument();
  });
});

function card() {
  return {
    id: "card-1",
    name: "American Express Gold Card",
    slug: "amex-gold",
    annualFeeCents: 32500,
    isActive: true,
    issuer: { id: "issuer-1", name: "American Express", slug: "amex" },
  };
}

function walletCard() {
  return {
    id: "user-card-1",
    cardId: "card-1",
    nickname: null,
    openedAt: null,
    annualFeeDueMonth: 5,
    welcomeBonusDeadline: null,
    isActive: true,
    card: card(),
  };
}
