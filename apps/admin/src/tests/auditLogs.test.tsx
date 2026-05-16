import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuditLogsPage } from "../pages/AuditLogsPage";
import { mockFetchQueue, renderWithRouter } from "./testUtils";

describe("AuditLogsPage", () => {
  it("renders logs and redacted before/after details", async () => {
    mockFetchQueue([
      [
        {
          id: "log_1",
          action: "UPDATE",
          entityType: "Card",
          entityId: "card_1",
          createdAt: "2026-05-11T00:00:00.000Z",
          adminUser: { email: "admin@example.com" },
          before: { name: "Old", token: "[REDACTED]" },
          after: { name: "New", token: "[REDACTED]" },
        },
      ],
    ]);
    renderWithRouter(<AuditLogsPage />);
    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("Card card_1")).toBeInTheDocument();
    expect(screen.getAllByText("Before")[0]).toBeInTheDocument();
  });
});
