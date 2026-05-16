import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JobsPage } from "../pages/JobsPage";
import { mockFetchQueue, renderWithRouter } from "./testUtils";

describe("JobsPage", () => {
  it("renders status, job runs, and manually triggers dry runs", async () => {
    const fetchMock = mockFetchQueue([
      {
        schedulerEnabled: false,
        registeredJobs: ["ADMIN_ALERT", "REMINDER_DIGEST"],
        configuredSchedules: [{ jobName: "ADMIN_ALERT", cron: "0 8 * * *" }],
        runningJobs: [],
        recentFailures: [],
      },
      [
        {
          id: "run_1",
          jobName: "ADMIN_ALERT",
          status: "SUCCEEDED",
          triggeredBy: "CLI",
          startedAt: "2026-05-11T12:00:00.000Z",
          durationMs: 10,
          result: { sentCount: 1 },
        },
      ],
      {
        id: "run_2",
        jobName: "REMINDER_DIGEST",
        status: "SUCCEEDED",
        triggeredBy: "MANUAL",
        startedAt: "2026-05-11T13:00:00.000Z",
        durationMs: 5,
        result: { sentCount: 0 },
      },
      [
        {
          id: "run_2",
          jobName: "REMINDER_DIGEST",
          status: "SUCCEEDED",
          triggeredBy: "MANUAL",
          startedAt: "2026-05-11T13:00:00.000Z",
          durationMs: 5,
          result: { sentCount: 0 },
        },
      ],
      {
        schedulerEnabled: false,
        registeredJobs: ["ADMIN_ALERT", "REMINDER_DIGEST"],
        configuredSchedules: [],
        runningJobs: [],
        recentFailures: [],
      },
    ]);

    renderWithRouter(<JobsPage />);

    expect(await screen.findByText("Disabled")).toBeInTheDocument();
    expect(screen.getAllByText("ADMIN_ALERT").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Run job" }));

    expect(await screen.findByText("Last run result")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/v1/admin/jobs/run",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          jobName: "REMINDER_DIGEST",
          dryRun: true,
          input: {},
        }),
      }),
    );
  });

  it("validates JSON input", async () => {
    mockFetchQueue([
      {
        schedulerEnabled: false,
        registeredJobs: ["ADMIN_ALERT"],
        configuredSchedules: [],
        runningJobs: [],
        recentFailures: [],
      },
      [],
    ]);
    renderWithRouter(<JobsPage />);

    fireEvent.change(await screen.findByLabelText("Input JSON"), {
      target: { value: "not json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run job" }));

    expect(await screen.findByText(/valid JSON/)).toBeInTheDocument();
  });
});
