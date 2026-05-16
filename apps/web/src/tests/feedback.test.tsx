import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../api/client.js";
import { FeedbackPage } from "../pages/FeedbackPage.js";

vi.mock("../api/client.js", () => ({
  apiClient: {
    getFeedbackReports: vi.fn(),
    submitFeedback: vi.fn(),
  },
}));

const mockedApi = vi.mocked(apiClient);

describe("FeedbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getFeedbackReports.mockResolvedValue([]);
    mockedApi.submitFeedback.mockResolvedValue({
      id: "feedback-1",
      feedbackType: "BUG",
      severity: "MEDIUM",
      status: "OPEN",
      title: "Bug",
      message: "Broken",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("renders feedback form and submits context", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/feedback?recommendationId=rec-1&type=WRONG_RECOMMENDATION",
        ]}
      >
        <FeedbackPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Beta Feedback")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Wrong card" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "The recommendation felt wrong." },
    });
    fireEvent.click(screen.getByText("Submit feedback"));

    await waitFor(() =>
      expect(mockedApi.submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackType: "WRONG_RECOMMENDATION",
          linkedRecommendationEventId: "rec-1",
        }),
      ),
    );
  });
});
