import { useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client.js";
import type { Reminder } from "../api/types.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

export function RemindersPage() {
  const [message, setMessage] = useState<string | null>(null);
  const state = useAsync(
    () => apiClient.getReminders({ includeDismissed: true }),
    [],
  );

  async function generateDefaults() {
    const result = await apiClient.generateDefaultReminders();
    setMessage(
      `Created ${result.createdCount}, updated ${result.updatedCount}, skipped ${result.skippedCount}.`,
    );
    state.reload();
  }

  async function createCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "").trim();
    const dueAt = String(form.get("dueAt") ?? "");
    if (!title || !dueAt) {
      setMessage("Title and due date are required.");
      return;
    }
    await apiClient.createReminder({
      reminderType: "CUSTOM",
      title,
      dueAt: new Date(dueAt).toISOString(),
      recurrence: "NONE",
    });
    formElement.reset();
    setMessage("Reminder created.");
    state.reload();
  }

  async function setStatus(reminder: Reminder, status: Reminder["status"]) {
    await apiClient.updateReminder(reminder.id, { status });
    state.reload();
  }

  if (state.isLoading) return <LoadingState label="Loading reminders" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        message={state.error ?? "Reminders unavailable."}
        onRetry={state.reload}
      />
    );
  }

  const grouped = groupReminders(state.data);

  return (
    <section>
      <PageHeader
        title="Reminders"
        description="Track annual fees, welcome bonus deadlines, statement credits, and custom rewards actions."
      />
      <div className="action-list">
        <button className="button" type="button" onClick={generateDefaults}>
          Generate defaults
        </button>
      </div>
      {message ? <p className="callout">{message}</p> : null}

      <section className="panel">
        <h2>Create custom reminder</h2>
        <form className="form-grid" onSubmit={createCustom}>
          <label>
            Title
            <input name="title" />
          </label>
          <label>
            Due date
            <input name="dueAt" type="datetime-local" />
          </label>
          <button className="button" type="submit">
            Create reminder
          </button>
        </form>
      </section>

      {state.data.length === 0 ? (
        <EmptyState
          title="No reminders yet"
          description="Generate default wallet reminders or create a custom action."
        />
      ) : (
        <div className="panel-grid">
          <ReminderGroup
            title="Overdue"
            reminders={grouped.overdue}
            onStatus={setStatus}
          />
          <ReminderGroup
            title="Due soon"
            reminders={grouped.dueSoon}
            onStatus={setStatus}
          />
          <ReminderGroup
            title="Upcoming"
            reminders={grouped.upcoming}
            onStatus={setStatus}
          />
          <ReminderGroup
            title="Done"
            reminders={grouped.done}
            onStatus={setStatus}
          />
        </div>
      )}
    </section>
  );
}

function ReminderGroup({
  title,
  reminders,
  onStatus,
}: {
  title: string;
  reminders: Reminder[];
  onStatus: (reminder: Reminder, status: Reminder["status"]) => void;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {reminders.length === 0 ? <p className="muted">Nothing here.</p> : null}
      {reminders.map((reminder) => (
        <article className="list-card" key={reminder.id}>
          <strong>{reminder.title}</strong>
          <p>{reminder.description}</p>
          <p>
            {reminder.reminderType.replaceAll("_", " ")} ·{" "}
            {new Date(reminder.dueAt).toLocaleString()} · {reminder.status}
          </p>
          <div className="action-list">
            <button
              className="button secondary"
              type="button"
              onClick={() => onStatus(reminder, "COMPLETED")}
            >
              Complete
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => onStatus(reminder, "DISMISSED")}
            >
              Dismiss
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function groupReminders(reminders: Reminder[]) {
  const now = Date.now();
  const soon = now + 7 * 24 * 60 * 60 * 1000;
  return {
    overdue: reminders.filter(
      (reminder) =>
        ["SCHEDULED", "DUE"].includes(reminder.status) &&
        new Date(reminder.dueAt).getTime() < now,
    ),
    dueSoon: reminders.filter((reminder) => {
      const dueAt = new Date(reminder.dueAt).getTime();
      return (
        ["SCHEDULED", "DUE"].includes(reminder.status) &&
        dueAt >= now &&
        dueAt <= soon
      );
    }),
    upcoming: reminders.filter((reminder) => {
      const dueAt = new Date(reminder.dueAt).getTime();
      return ["SCHEDULED", "DUE"].includes(reminder.status) && dueAt > soon;
    }),
    done: reminders.filter((reminder) =>
      ["COMPLETED", "DISMISSED"].includes(reminder.status),
    ),
  };
}
