import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import type {
  AdminFeedbackReport,
  FeedbackSeverity,
  FeedbackStatus,
} from "../api/types";
import { DateTime } from "../components/DateTime";
import { ErrorState } from "../components/ErrorState";
import { JsonDetails } from "../components/JsonDetails";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";

const statuses: FeedbackStatus[] = [
  "OPEN",
  "TRIAGED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
];
const severities: FeedbackSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function AdminFeedbackDetailPage() {
  const { id } = useParams();
  const api = useAdminApi();
  const state = useAsync(
    async () =>
      id ? ((await api.getAdminFeedback(id)) as AdminFeedbackReport) : null,
    [api, id],
  );

  if (!id) return <ErrorState error="Missing feedback id." />;
  if (state.isLoading) return <LoadingState label="Loading feedback" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        error={state.error ?? "Feedback not found."}
        onRetry={state.reload}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={state.data.title}
        description="Feedback triage detail."
      />
      <section className="panel stack">
        <div className="split-row">
          <StatusBadge value={state.data.status} />
          <StatusBadge value={state.data.severity} />
        </div>
        <p>{state.data.message}</p>
        <p className="muted">
          Submitted by {state.data.user?.email ?? "Unknown"} on{" "}
          <DateTime value={state.data.createdAt} />
        </p>
        {state.data.pageUrl ? (
          <a href={state.data.pageUrl}>Open reported page</a>
        ) : null}
        {state.data.linkedRecommendationEvent ? (
          <p>
            Recommendation: {state.data.linkedRecommendationEvent.id}{" "}
            {state.data.linkedRecommendationEvent.merchantNameInput ?? ""}
          </p>
        ) : null}
        {state.data.linkedTransaction ? (
          <p>Transaction: {state.data.linkedTransaction.rawMerchantName}</p>
        ) : null}
        <JsonDetails title="Context" value={state.data.context} />
      </section>
      <section className="panel">
        <h2>Triage</h2>
        <FeedbackUpdateForm report={state.data} onSaved={state.reload} />
      </section>
      <Link to="/feedback">Back to feedback</Link>
    </>
  );
}

function FeedbackUpdateForm({
  report,
  onSaved,
}: {
  report: AdminFeedbackReport;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const [status, setStatus] = useState<FeedbackStatus>(report.status);
  const [severity, setSeverity] = useState<FeedbackSeverity>(report.severity);
  const [resolutionNotes, setResolutionNotes] = useState(
    report.resolutionNotes ?? "",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.updateAdminFeedback(report.id, {
      status,
      severity,
      resolutionNotes: resolutionNotes || null,
    });
    setMessage("Feedback updated.");
    onSaved();
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as FeedbackStatus)}
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Severity
        <select
          value={severity}
          onChange={(event) =>
            setSeverity(event.target.value as FeedbackSeverity)
          }
        >
          {severities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Resolution notes
        <textarea
          value={resolutionNotes}
          onChange={(event) => setResolutionNotes(event.target.value)}
        />
      </label>
      {message ? <p className="success-message">{message}</p> : null}
      <button type="submit">Save triage</button>
    </form>
  );
}
