import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardFormPage } from "../pages/CardFormPage";
import { CardsPage } from "../pages/CardsPage";
import { mockFetchQueue, renderWithRouter } from "./testUtils";

describe("card admin pages", () => {
  it("renders cards", async () => {
    mockFetchQueue([
      [
        {
          id: "card_1",
          name: "Amex Gold",
          issuer: { name: "American Express" },
          isActive: true,
        },
      ],
    ]);
    renderWithRouter(<CardsPage />);
    expect(await screen.findByText("Amex Gold")).toBeInTheDocument();
  });

  it("validates required issuer and name", async () => {
    mockFetchQueue([[{ id: "issuer_1", name: "Issuer" }], null]);
    renderWithRouter(<CardFormPage />, "/cards/new");
    fireEvent.click(await screen.findByRole("button", { name: "Create card" }));
    expect(
      await screen.findByText("Issuer and name are required."),
    ).toBeInTheDocument();
  });

  it("submits create card", async () => {
    const fetchMock = mockFetchQueue([
      [{ id: "issuer_1", name: "Issuer" }],
      { id: "card_1" },
    ]);
    renderWithRouter(<CardFormPage />, "/cards/new");
    fireEvent.change(await screen.findByLabelText("Issuer"), {
      target: { value: "issuer_1" },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "New Card" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create card" }));
    expect(
      await screen.findByRole("button", { name: "Create card" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/admin/cards"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
