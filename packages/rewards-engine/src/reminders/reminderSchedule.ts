import type {
  ReminderLike,
  ReminderRecurrence,
  ReminderUrgency,
  StatementCreditPeriod,
} from "./reminderTypes.js";

const dayMs = 24 * 60 * 60 * 1000;

export function computeAnnualFeeReminderDate(
  annualFeeDueMonth: number,
  now: Date | string = new Date(),
): Date {
  if (
    !Number.isInteger(annualFeeDueMonth) ||
    annualFeeDueMonth < 1 ||
    annualFeeDueMonth > 12
  ) {
    throw new Error("annualFeeDueMonth must be an integer from 1 to 12.");
  }

  const anchor = new Date(now);
  const year =
    annualFeeDueMonth - 1 < anchor.getUTCMonth()
      ? anchor.getUTCFullYear() + 1
      : anchor.getUTCFullYear();
  const dueMonthStart = new Date(Date.UTC(year, annualFeeDueMonth - 1, 1));
  return new Date(dueMonthStart.getTime() - 30 * dayMs);
}

export function computeWelcomeBonusReminderDate(deadline: Date | string): Date {
  return new Date(new Date(deadline).getTime() - 14 * dayMs);
}

export function computeStatementCreditPeriod(
  recurrence: ReminderRecurrence,
  now: Date | string = new Date(),
): StatementCreditPeriod {
  const anchor = new Date(now);
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();

  if (recurrence === "MONTHLY" || recurrence === "NONE") {
    return monthPeriod(year, month);
  }

  if (recurrence === "QUARTERLY") {
    const startMonth = Math.floor(month / 3) * 3;
    return monthSpanPeriod(year, startMonth, 3);
  }

  if (recurrence === "SEMIANNUAL") {
    const startMonth = month < 6 ? 0 : 6;
    return monthSpanPeriod(year, startMonth, 6);
  }

  return monthSpanPeriod(year, 0, 12);
}

export function computeStatementCreditReminderDate(
  recurrence: ReminderRecurrence,
  periodStart: Date | string,
  periodEnd: Date | string,
): Date {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  if (recurrence === "MONTHLY" || recurrence === "NONE") {
    return start;
  }

  return new Date(end.getTime() - 14 * dayMs);
}

export function summarizeReminderUrgency(
  reminder: ReminderLike,
  now: Date | string = new Date(),
): ReminderUrgency {
  if (reminder.status === "COMPLETED" || reminder.status === "DISMISSED") {
    return "COMPLETE";
  }

  const dueAt = new Date(reminder.dueAt);
  const anchor = new Date(now);
  if (dueAt.getTime() < anchor.getTime()) {
    return "OVERDUE";
  }

  if (dueAt.getTime() <= anchor.getTime() + 7 * dayMs) {
    return "DUE_SOON";
  }

  return "UPCOMING";
}

function monthPeriod(year: number, month: number): StatementCreditPeriod {
  return monthSpanPeriod(year, month, 1);
}

function monthSpanPeriod(
  year: number,
  startMonth: number,
  monthCount: number,
): StatementCreditPeriod {
  return {
    periodStart: new Date(Date.UTC(year, startMonth, 1)),
    periodEnd: new Date(Date.UTC(year, startMonth + monthCount, 1)),
  };
}
