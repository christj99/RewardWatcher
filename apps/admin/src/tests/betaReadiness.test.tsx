import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BetaReadinessPage } from "../pages/BetaReadinessPage";
import { mockFetchQueue, renderWithRouter } from "./testUtils";

describe("BetaReadinessPage", () => {
  it("renders launch gate status, checklist, and critical flow links", async () => {
    mockFetchQueue([
      {
        generatedAt: "2026-05-11T00:00:00.000Z",
        status: "CAUTION",
        checks: [],
        config: {
          plaidConfigured: false,
          stripeConfigured: true,
          postmarkConfigured: false,
          sentryConfigured: true,
          schedulerEnabled: false,
        },
        operations: {
          databaseReady: true,
          recentJobFailures: 0,
          recentEmailFailures: 1,
          recentPlaidFailures: 0,
          recentStripeWebhookFailures: 0,
          openHighPriorityReviewTasks: 2,
          unresolvedPrivacyRequests: 0,
          recentAdminAuditLogCount: 4,
        },
        productHealth: {
          usersCount: 12,
          activeBetaUsersCount: 3,
          activeSubscriptionsCount: 1,
          recommendationErrorRateLast7Days: 0.02,
          recommendationErrorRateLast30Days: 0.03,
          killTest: {
            overallPass: true,
            usersEvaluated: 5,
            meaningfulMissedValueCents: 1200,
            recommendationErrorRate: 0.01,
            reasons: [],
          },
        },
        releaseChecklist: [
          {
            key: "database",
            label: "Database readiness",
            complete: true,
            status: "PASS",
            details: "Database query succeeded.",
          },
          {
            key: "scheduler",
            label: "Scheduler decision",
            complete: false,
            status: "WARN",
            details: "Scheduler is disabled.",
          },
        ],
      },
    ]);

    renderWithRouter(<BetaReadinessPage />, "/beta-readiness");

    expect(await screen.findByText("Beta Readiness")).toBeInTheDocument();
    expect(screen.getByText("Launch Gate")).toBeInTheDocument();
    expect(screen.getByText("Database readiness")).toBeInTheDocument();
    expect(screen.getByText("Scheduler decision")).toBeInTheDocument();
    expect(screen.getByText("Critical Flows")).toBeInTheDocument();
    expect(screen.getByText("Open jobs")).toBeInTheDocument();
  });
});
