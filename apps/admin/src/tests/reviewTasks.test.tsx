import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReviewTasksPage } from "../pages/ReviewTasksPage";
import { mockFetchQueue, renderWithRouter } from "./testUtils";

describe("ReviewTasksPage", () => {
  it("renders tasks and updates status", async () => {
    const fetchMock = mockFetchQueue([
      [
        {
          id: "task_1",
          title: "Check category",
          taskType: "MERCHANT_DATA",
          priority: "HIGH",
          status: "OPEN",
          createdAt: "2026-05-11T00:00:00.000Z",
        },
      ],
      { id: "task_1", status: "IN_PROGRESS" },
      [
        {
          id: "task_1",
          title: "Check category",
          taskType: "MERCHANT_DATA",
          priority: "HIGH",
          status: "IN_PROGRESS",
          createdAt: "2026-05-11T00:00:00.000Z",
        },
      ],
    ]);

    renderWithRouter(<ReviewTasksPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Start" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/admin/review-tasks/task_1"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
