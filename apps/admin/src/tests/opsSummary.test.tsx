import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OpsSummaryPage } from "../pages/OpsSummaryPage";
import { mockFetchQueue, renderWithRouter } from "./testUtils";

describe("OpsSummaryPage", () => {
  it("renders diagnostics and recent failure counts", async () => {
    mockFetchQueue([
      {
        generatedAt: "2026-05-11T00:00:00.000Z",
        recentJobFailures: 1,
        recentEmailFailures: 2,
        recentPlaidFailures: 3,
        recentStripeWebhookFailures: 4,
        recommendationErrorsLast7Days: 5,
        openHighPriorityReviewTasks: 6,
        usersCount: 7,
        activeSubscriptionsCount: 8,
        activePlaidConnectionsCount: 9,
        latestJobFailures: [
          {
            id: "run_1",
            jobName: "ADMIN_ALERT",
            startedAt: "2026-05-11T00:00:00.000Z",
            errorMessage: "Test failure",
          },
        ],
      },
      {
        version: "test",
        appEnv: "test",
        nodeEnv: "test",
        uptimeSeconds: 42,
        database: "ok",
        schedulerEnabled: false,
        registeredJobs: ["ADMIN_ALERT"],
        runningJobCount: 0,
        recentJobFailureCount: 1,
        config: { sentryConfigured: false },
      },
    ]);

    renderWithRouter(<OpsSummaryPage />);

    expect(await screen.findByText("Ops Summary")).toBeInTheDocument();
    expect(screen.getByText("Job failures / 24h")).toBeInTheDocument();
    expect(screen.getByText("ADMIN_ALERT")).toBeInTheDocument();
    expect(screen.getByText("Test failure")).toBeInTheDocument();
  });
});
