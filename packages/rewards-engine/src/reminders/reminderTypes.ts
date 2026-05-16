export type ReminderRecurrence =
  | "NONE"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL";

export type ReminderStatus = "SCHEDULED" | "DUE" | "COMPLETED" | "DISMISSED";

export type ReminderUrgency = "OVERDUE" | "DUE_SOON" | "UPCOMING" | "COMPLETE";

export type ReminderLike = {
  dueAt: Date | string;
  status: ReminderStatus;
};

export type StatementCreditPeriod = {
  periodStart: Date;
  periodEnd: Date;
};
