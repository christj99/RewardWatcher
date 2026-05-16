import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminFeedbackPage } from "../pages/AdminFeedbackPage";
import { BetaUsersPage } from "../pages/BetaUsersPage";
import { mockFetchQueue, renderWithRouter } from "./testUtils";

describe("admin feedback and beta support pages", () => {
  it("renders feedback reports", async () => {
    mockFetchQueue([
      [
        {
          id: "feedback-1",
          user: { id: "user-1", email: "beta@example.com" },
          feedbackType: "BUG",
          severity: "HIGH",
          status: "OPEN",
          title: "Checkout broke",
          message: "The extension did not show.",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    ]);

    renderWithRouter(<AdminFeedbackPage />, "/feedback");

    expect(await screen.findByText("Checkout broke")).toBeInTheDocument();
    expect(screen.getByText("beta@example.com")).toBeInTheDocument();
  });

  it("renders beta users and posts support notes", async () => {
    const fetchMock = mockFetchQueue([
      [
        {
          id: "user-1",
          email: "beta@example.com",
          betaProfile: {
            status: "ACTIVE",
            tags: [],
            cohort: {
              id: "cohort-1",
              name: "Private Beta",
              slug: "private-beta",
            },
          },
          milestones: {
            recommendationCount: 2,
            transactionAuditCount: 1,
            feedbackCount: 1,
            supportNoteCount: 0,
            lastActiveAt: "2026-01-01T00:00:00.000Z",
          },
          plaidStatusCounts: {},
        },
      ],
      [],
      {
        id: "note-1",
        note: "Follow up",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      [],
    ]);

    renderWithRouter(<BetaUsersPage />, "/beta-users");

    fireEvent.click(await screen.findByText("Open"));
    fireEvent.change(screen.getByRole("textbox", { name: "" }), {
      target: { value: "Follow up" },
    });
    fireEvent.click(screen.getByText("Add note"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findAllByText("beta@example.com")).toHaveLength(2);
  });
});
