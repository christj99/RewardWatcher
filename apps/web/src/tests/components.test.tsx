import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { ConfidenceLevel, OutcomeType } from "../api/types.js";
import { ConfidenceBadge } from "../components/ConfidenceBadge.js";
import { EmptyState } from "../components/EmptyState.js";
import { MoneyValue } from "../components/MoneyValue.js";
import { OutcomeBadge } from "../components/OutcomeBadge.js";

describe("shared components", () => {
  it("renders all confidence levels", () => {
    const levels: ConfidenceLevel[] = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"];
    render(
      <>
        {levels.map((level) => (
          <ConfidenceBadge key={level} level={level} />
        ))}
      </>,
    );

    expect(screen.getByText("High confidence")).toBeInTheDocument();
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByText("Unknown confidence")).toBeInTheDocument();
  });

  it("renders all outcome types", () => {
    const outcomes: OutcomeType[] = [
      "CAPTURED_OPTIMAL",
      "USER_MISSED_VALUE",
      "RECOMMENDATION_ERROR",
      "UNMATCHED",
      "USER_OVERRIDE",
      "INCONCLUSIVE",
    ];
    render(
      <>
        {outcomes.map((type) => (
          <OutcomeBadge key={type} type={type} />
        ))}
      </>,
    );

    expect(screen.getByText("Captured optimal")).toBeInTheDocument();
    expect(screen.getByText("Missed value")).toBeInTheDocument();
    expect(screen.getByText("Recommendation error")).toBeInTheDocument();
    expect(screen.getByText("Unmatched")).toBeInTheDocument();
    expect(screen.getByText("User override")).toBeInTheDocument();
    expect(screen.getByText("Inconclusive")).toBeInTheDocument();
  });

  it("formats money values and empty state actions", () => {
    render(
      <MemoryRouter>
        <MoneyValue cents={12345} />
        <EmptyState
          title="Nothing here"
          description="Try a next step."
          actionHref="/lookup"
          actionLabel="Look up merchant"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("$123.45")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Look up merchant" }),
    ).toHaveAttribute("href", "/lookup");
  });
});
