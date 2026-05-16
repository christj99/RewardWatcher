import { describe, expect, it } from "vitest";

import {
  computeAnnualFeeReminderDate,
  computeStatementCreditPeriod,
  computeWelcomeBonusReminderDate,
  summarizeReminderUrgency,
} from "../reminderSchedule.js";

describe("reminder schedule helpers", () => {
  it("computes annual fee reminder dates 30 days before the due month", () => {
    expect(
      computeAnnualFeeReminderDate(6, "2026-05-10T00:00:00Z").toISOString(),
    ).toBe("2026-05-02T00:00:00.000Z");
  });

  it("computes welcome bonus reminders 14 days before deadline", () => {
    expect(
      computeWelcomeBonusReminderDate("2026-06-15T00:00:00Z").toISOString(),
    ).toBe("2026-06-01T00:00:00.000Z");
  });

  it("computes monthly, quarterly, and annual statement credit periods", () => {
    expect(
      computeStatementCreditPeriod("MONTHLY", "2026-05-10T00:00:00Z")
        .periodStart,
    ).toEqual(new Date("2026-05-01T00:00:00.000Z"));
    expect(
      computeStatementCreditPeriod("QUARTERLY", "2026-05-10T00:00:00Z")
        .periodStart,
    ).toEqual(new Date("2026-04-01T00:00:00.000Z"));
    expect(
      computeStatementCreditPeriod("ANNUAL", "2026-05-10T00:00:00Z").periodEnd,
    ).toEqual(new Date("2027-01-01T00:00:00.000Z"));
  });

  it("classifies reminder urgency", () => {
    const now = "2026-05-10T00:00:00Z";
    expect(
      summarizeReminderUrgency(
        { dueAt: "2026-05-09T00:00:00Z", status: "SCHEDULED" },
        now,
      ),
    ).toBe("OVERDUE");
    expect(
      summarizeReminderUrgency(
        { dueAt: "2026-05-15T00:00:00Z", status: "DUE" },
        now,
      ),
    ).toBe("DUE_SOON");
    expect(
      summarizeReminderUrgency(
        { dueAt: "2026-06-15T00:00:00Z", status: "SCHEDULED" },
        now,
      ),
    ).toBe("UPCOMING");
    expect(
      summarizeReminderUrgency(
        { dueAt: "2026-05-09T00:00:00Z", status: "COMPLETED" },
        now,
      ),
    ).toBe("COMPLETE");
  });
});
