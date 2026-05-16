import { useState } from "react";
import { useParams } from "react-router-dom";

import { DateTime } from "../components/DateTime";
import { ErrorState } from "../components/ErrorState";
import { FormField } from "../components/FormField";
import { JsonDetails } from "../components/JsonDetails";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";

export function ReviewTaskDetailPage() {
  const { id } = useParams();
  const api = useAdminApi();
  const state = useAsync(() => api.getReviewTask(id ?? ""), [api, id]);
  const [message, setMessage] = useState<string | null>(null);

  if (state.isLoading) return <LoadingState />;
  if (state.error)
    return <ErrorState error={state.error} onRetry={state.reload} />;
  const task = state.data as any;
  if (!task) return <ErrorState error="Review task not found." />;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.updateReviewTask(id ?? "", {
      status: form.get("status"),
      priority: form.get("priority"),
      resolutionNotes: String(form.get("resolutionNotes") ?? ""),
    });
    setMessage("Review task updated.");
    await state.reload();
  }

  return (
    <>
      <PageHeader
        title={task.title ?? "Review task"}
        description="Inspect context and update curation status."
      />
      {message ? <p className="notice">{message}</p> : null}
      <div className="grid">
        <section className="panel">
          <h2>Task</h2>
          <p>
            <StatusBadge value={task.status} />{" "}
            <StatusBadge value={task.priority} />
          </p>
          <p>{task.description}</p>
          <p>
            Created <DateTime value={task.createdAt} />
          </p>
          <JsonDetails title="Linked correction" value={task.correction} />
          <JsonDetails
            title="Recommendation snapshots"
            value={
              task.correction?.recommendationEvent ?? task.recommendationEvent
            }
          />
        </section>
        <form className="panel" onSubmit={(event) => void submit(event)}>
          <h2>Update</h2>
          <FormField label="Status">
            <select name="status" defaultValue={task.status ?? "OPEN"}>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </FormField>
          <FormField label="Priority">
            <select name="priority" defaultValue={task.priority ?? "MEDIUM"}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </FormField>
          <FormField label="Resolution notes">
            <textarea
              name="resolutionNotes"
              defaultValue={task.resolutionNotes ?? ""}
            />
          </FormField>
          <button type="submit">Save task</button>
        </form>
      </div>
    </>
  );
}
