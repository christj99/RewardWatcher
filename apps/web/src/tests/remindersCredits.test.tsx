import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../api/client.js";
import { CreditsPage } from "../pages/CreditsPage.js";
import { RemindersPage } from "../pages/RemindersPage.js";

vi.mock("../api/client.js", () => ({
  apiClient: {
    getReminders: vi.fn(),
    createReminder: vi.fn(),
    updateReminder: vi.fn(),
    generateDefaultReminders: vi.fn(),
    getStatementCreditUsage: vi.fn(),
    generateStatementCreditUsage: vi.fn(),
    updateStatementCreditUsage: vi.fn(),
  },
}));

const mockedApi = vi.mocked(apiClient);

describe("reminders and credits pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getReminders.mockResolvedValue([reminder()]);
    mockedApi.createReminder.mockResolvedValue(reminder());
    mockedApi.updateReminder.mockResolvedValue(reminder());
    mockedApi.generateDefaultReminders.mockResolvedValue({
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      reminders: [reminder()],
    });
    mockedApi.getStatementCreditUsage.mockResolvedValue([usage()]);
    mockedApi.generateStatementCreditUsage.mockResolvedValue({
      generatedCount: 1,
      updatedCount: 0,
      usageRecords: [usage()],
    });
    mockedApi.updateStatementCreditUsage.mockResolvedValue(usage());
  });

  it("renders reminders and generates defaults", async () => {
    render(
      <MemoryRouter>
        <RemindersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Use Uber Cash")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate defaults" }));

    await waitFor(() =>
      expect(mockedApi.generateDefaultReminders).toHaveBeenCalled(),
    );
    expect(
      await screen.findByText("Created 1, updated 0, skipped 0."),
    ).toBeInTheDocument();
  });

  it("creates custom reminders and completes reminders", async () => {
    render(
      <MemoryRouter>
        <RemindersPage />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Title"), {
      target: { value: "Check annual fee" },
    });
    fireEvent.change(screen.getByLabelText("Due date"), {
      target: { value: "2500-01-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create reminder" }));
    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));

    await waitFor(() =>
      expect(mockedApi.createReminder).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Check annual fee" }),
      ),
    );
    expect(mockedApi.updateReminder).toHaveBeenCalledWith("reminder-1", {
      status: "COMPLETED",
    });
  });

  it("renders credit usage, generates usage, and manually updates status", async () => {
    render(
      <MemoryRouter>
        <CreditsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Amex Gold Uber Cash")).toBeInTheDocument();
    expect(screen.getAllByText("$5.00").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Generate usage" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark used" }));

    await waitFor(() =>
      expect(mockedApi.generateStatementCreditUsage).toHaveBeenCalledWith({
        inferFromTransactions: true,
      }),
    );
    expect(mockedApi.updateStatementCreditUsage).toHaveBeenCalledWith(
      "usage-1",
      { status: "USED" },
    );
  });
});

function reminder() {
  return {
    id: "reminder-1",
    reminderType: "STATEMENT_CREDIT" as const,
    title: "Use Uber Cash",
    description: "Use monthly dining credit.",
    dueAt: "2500-01-01T00:00:00.000Z",
    status: "SCHEDULED" as const,
    recurrence: "MONTHLY" as const,
    source: "STATEMENT_CREDIT",
  };
}

function usage() {
  return {
    id: "usage-1",
    periodStart: "2500-01-01T00:00:00.000Z",
    periodEnd: "2500-02-01T00:00:00.000Z",
    status: "PARTIALLY_USED" as const,
    amountUsedCents: 500,
    estimatedRemainingCents: 500,
    source: "IMPORTED_TRANSACTION",
    statementCredit: {
      id: "credit-1",
      name: "Amex Gold Uber Cash",
      description: "Monthly Uber Cash estimate.",
      amountCents: 1000,
      recurrence: "MONTHLY",
    },
    userCard: {
      id: "user-card-1",
      cardId: "card-1",
      isActive: true,
      card: {
        id: "card-1",
        name: "American Express Gold Card",
        slug: "amex-gold",
      },
    },
  };
}
