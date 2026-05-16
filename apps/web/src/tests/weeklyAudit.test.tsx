import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../api/client.js";
import { WeeklyAuditPage } from "../pages/WeeklyAuditPage.js";

vi.mock("../api/client.js", () => ({
  apiClient: {
    getWeeklyAudit: vi.fn(),
  },
}));

const mockedApi = vi.mocked(apiClient);

describe("weekly audit page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getWeeklyAudit.mockResolvedValue(report());
  });

  it("renders captured, missed, meaningful values, top miss, action, and notes", async () => {
    render(
      <MemoryRouter>
        <WeeklyAuditPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Captured value")).toBeInTheDocument();
    expect(screen.getByText("$12.00")).toBeInTheDocument();
    expect(screen.getAllByText("$9.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Top miss: Starbucks")).toBeInTheDocument();
    expect(
      screen.getAllByText("Use American Express Gold Card next time.")[0],
    ).toBeInTheDocument();
    expect(
      screen.getByText("Some outcomes were low confidence."),
    ).toBeInTheDocument();
  });

  it("shows empty report state", async () => {
    mockedApi.getWeeklyAudit.mockResolvedValue({
      ...report(),
      items: [],
      topMiss: null,
    });
    render(
      <MemoryRouter>
        <WeeklyAuditPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("No report items")).toBeInTheDocument();
  });
});

function report() {
  return {
    weekStart: "2026-01-01T00:00:00.000Z",
    weekEnd: "2026-01-08T00:00:00.000Z",
    minMissedValueCents: 100,
    totalTransactionsAudited: 1,
    totalOutcomes: 1,
    totalRecommendationsMatched: 1,
    estimatedValueCapturedCents: 1200,
    estimatedValueMissedCents: 900,
    meaningfulMissedValueCents: 900,
    meaningfulMissCount: 1,
    capturedOptimalCount: 0,
    userMissedValueCount: 1,
    recommendationErrorCount: 0,
    unmatchedCount: 0,
    userOverrideCount: 0,
    inconclusiveCount: 0,
    topMiss: item(),
    recommendedAction: "Use American Express Gold Card next time.",
    confidenceNotes: ["Some outcomes were low confidence."],
    items: [item()],
  };
}

function item() {
  return {
    outcomeId: "outcome-1",
    transactionId: "transaction-1",
    transactionDate: "2026-01-03T00:00:00.000Z",
    merchantName: "Starbucks",
    amountCents: 5000,
    outcomeType: "USER_MISSED_VALUE" as const,
    confidence: "LOW" as const,
    explanation: "You used a lower value card.",
    actualCard: { id: "card-2", name: "Chase Freedom Unlimited" },
    bestCard: { id: "card-1", name: "American Express Gold Card" },
    recommendedCard: { id: "card-1", name: "American Express Gold Card" },
    capturedValueCents: 100,
    missedValueCents: 900,
    expectedValueCents: 1000,
    isMeaningfulMiss: true,
    actionText: "Use American Express Gold Card next time.",
    warnings: [],
  };
}
