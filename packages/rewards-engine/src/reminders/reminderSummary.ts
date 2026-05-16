import { summarizeReminderUrgency } from "./reminderSchedule.js";
import type { ReminderLike, ReminderUrgency } from "./reminderTypes.js";

export function countReminderUrgencies(
  reminders: ReminderLike[],
  now: Date | string = new Date(),
): Record<ReminderUrgency, number> {
  return reminders.reduce<Record<ReminderUrgency, number>>(
    (counts, reminder) => {
      counts[summarizeReminderUrgency(reminder, now)] += 1;
      return counts;
    },
    { OVERDUE: 0, DUE_SOON: 0, UPCOMING: 0, COMPLETE: 0 },
  );
}
