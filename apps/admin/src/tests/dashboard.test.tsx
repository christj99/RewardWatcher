import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { mockFetchQueue, renderWithRouter } from "./testUtils";

describe("AdminDashboardPage", () => {
  it("renders review, freshness, and kill-test summaries", async () => {
    mockFetchQueue([
      { openReviewTasks: 4, highPriorityReviewTasks: 1, openCorrections: 2 },
      {
        staleRules: [{ id: "r1" }],
        missingSourceRules: [{ id: "r2" }],
        lowConfidenceRules: [],
      },
      { totalRecommendationErrors: 3 },
      {
        metrics: {
          passFail: { overallPass: true, reasons: [] },
          percentUsersWithMeaningfulMiss: 50,
          totalMeaningfulMissedValueCents: 12345,
        },
      },
    ]);

    renderWithRouter(<AdminDashboardPage />);

    expect(await screen.findByText("Open review tasks")).toBeInTheDocument();
    expect(screen.getByText("Stale earning rules")).toBeInTheDocument();
    expect(screen.getByText("Kill-test result")).toBeInTheDocument();
    expect(screen.getByText("$123.45")).toBeInTheDocument();
  });
});
