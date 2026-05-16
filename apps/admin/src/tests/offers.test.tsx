import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OfferFormPage } from "../pages/OfferFormPage";
import { OffersPage } from "../pages/OffersPage";
import { mockFetchQueue, renderWithRouter } from "./testUtils";

describe("offer admin pages", () => {
  it("renders offers", async () => {
    mockFetchQueue([
      [
        {
          id: "offer_1",
          title: "Uber credit",
          offerType: "STATEMENT_CREDIT",
          valueCents: 1000,
          confidence: "MEDIUM",
        },
      ],
    ]);
    renderWithRouter(<OffersPage />);
    expect(await screen.findByText("Uber credit")).toBeInTheDocument();
  });

  it("validates targeting", async () => {
    mockFetchQueue([[], [], [], [], [], null]);
    renderWithRouter(<OfferFormPage />, "/offers/new");
    fireEvent.change(await screen.findByLabelText("Title"), {
      target: { value: "Offer" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create offer" }));
    expect(
      await screen.findByText("At least one targeting field is required."),
    ).toBeInTheDocument();
  });

  it("validates value fields by offer type", async () => {
    mockFetchQueue([
      [{ id: "issuer_1", name: "Issuer" }],
      [],
      [],
      [],
      [],
      null,
    ]);
    renderWithRouter(<OfferFormPage />, "/offers/new");
    fireEvent.change(await screen.findByLabelText("Issuer"), {
      target: { value: "issuer_1" },
    });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Offer" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create offer" }));
    expect(
      await screen.findByText(
        "Statement credit and discount offers require value cents or explanatory notes.",
      ),
    ).toBeInTheDocument();
  });

  it("expire offer confirm calls API", async () => {
    const fetchMock = mockFetchQueue([
      [
        {
          id: "offer_1",
          title: "Offer",
          offerType: "DISCOUNT",
          valueCents: 500,
          confidence: "HIGH",
        },
      ],
      { id: "offer_1" },
      [],
    ]);
    renderWithRouter(<OffersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Expire" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/admin/offers/offer_1/expire"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
