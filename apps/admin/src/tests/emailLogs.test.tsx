import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { EmailLogsPage } from "../pages/EmailLogsPage";
import { mockFetchQueue } from "./testUtils";

describe("EmailLogsPage", () => {
  it("renders redacted email logs", async () => {
    const fetchMock = mockFetchQueue([
      [
        {
          id: "email-1",
          toEmailRedacted: "b***@example.com",
          emailType: "WEEKLY_AUDIT",
          subject: "Your weekly rewards audit",
          status: "SENT",
          provider: "console",
          createdAt: "2026-05-11T00:00:00.000Z",
          sentAt: "2026-05-11T00:00:01.000Z",
        },
      ],
    ]);

    render(
      <MemoryRouter>
        <EmailLogsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("b***@example.com")).toBeInTheDocument();
    expect(screen.getByText("WEEKLY_AUDIT")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/v1/admin/email-logs",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
