import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EarningRuleFormPage } from "../pages/EarningRuleFormPage";
import { EarningRulesPage } from "../pages/EarningRulesPage";
import { mockFetchQueue, renderWithRouter } from "./testUtils";

describe("earning rule admin pages", () => {
  it("renders earning rules", async () => {
    mockFetchQueue([
      [
        {
          id: "rule_1",
          card: { name: "Amex Gold" },
          category: "DINING",
          multiplier: "4",
          confidence: "HIGH",
        },
      ],
    ]);
    renderWithRouter(<EarningRulesPage />);
    expect(await screen.findByText("Amex Gold")).toBeInTheDocument();
  });

  it("validates multiplier", async () => {
    mockFetchQueue([
      [{ id: "card_1", name: "Card" }],
      [{ id: "cur_1", code: "POINTS", name: "Points" }],
      [],
      [],
      null,
    ]);
    renderWithRouter(<EarningRuleFormPage />, "/earning-rules/new");
    fireEvent.change(await screen.findByLabelText("Card"), {
      target: { value: "card_1" },
    });
    fireEvent.change(screen.getByLabelText("Reward currency"), {
      target: { value: "cur_1" },
    });
    fireEvent.change(screen.getByLabelText("Multiplier"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));
    expect(
      await screen.findByText("Multiplier must be positive."),
    ).toBeInTheDocument();
  });

  it("validates cap pair", async () => {
    mockFetchQueue([
      [{ id: "card_1", name: "Card" }],
      [{ id: "cur_1", code: "POINTS", name: "Points" }],
      [],
      [],
      null,
    ]);
    renderWithRouter(<EarningRuleFormPage />, "/earning-rules/new");
    fireEvent.change(await screen.findByLabelText("Card"), {
      target: { value: "card_1" },
    });
    fireEvent.change(screen.getByLabelText("Reward currency"), {
      target: { value: "cur_1" },
    });
    fireEvent.change(screen.getByLabelText("Multiplier"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Cap amount cents"), {
      target: { value: "10000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));
    expect(
      await screen.findByText(
        "Cap amount and cap period must be provided together.",
      ),
    ).toBeInTheDocument();
  });

  it("retire confirm calls API", async () => {
    const fetchMock = mockFetchQueue([
      [
        {
          id: "rule_1",
          card: { name: "Card" },
          category: "DINING",
          multiplier: "3",
          confidence: "MEDIUM",
        },
      ],
      { id: "rule_1" },
      [],
    ]);
    renderWithRouter(<EarningRulesPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Retire" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/admin/earning-rules/rule_1/retire"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
