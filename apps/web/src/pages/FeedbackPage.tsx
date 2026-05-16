import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { errorMessage } from "../api/errors.js";
import type { FeedbackSeverity, FeedbackType } from "../api/types.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

const feedbackTypes: FeedbackType[] = [
  "BUG",
  "CONFUSING_RECOMMENDATION",
  "WRONG_RECOMMENDATION",
  "PLAID_ISSUE",
  "BILLING_ISSUE",
  "EXTENSION_ISSUE",
  "PRIVACY_ISSUE",
  "FEATURE_REQUEST",
  "GENERAL_FEEDBACK",
];

const severities: FeedbackSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function FeedbackPage() {
  const [params] = useSearchParams();
  const state = useAsync(() => apiClient.getFeedbackReports(), []);
  const initialType = useMemo(
    () =>
      feedbackTypes.includes(params.get("type") as FeedbackType)
        ? (params.get("type") as FeedbackType)
        : "GENERAL_FEEDBACK",
    [params],
  );

  return (
    <section>
      <PageHeader
        title="Beta Feedback"
        description="Send the team bugs, confusing recommendations, and private beta support notes."
      />
      <section className="panel">
        <h2>Send feedback</h2>
        <FeedbackForm
          initialType={initialType}
          linkedRecommendationEventId={params.get("recommendationId") ?? ""}
          linkedTransactionId={params.get("transactionId") ?? ""}
          linkedOutcomeId={params.get("outcomeId") ?? ""}
          onSubmitted={state.reload}
        />
      </section>
      <section className="panel">
        <h2>Your reports</h2>
        {state.isLoading ? <LoadingState label="Loading feedback" /> : null}
        {state.error ? (
          <ErrorState message={state.error} onRetry={state.reload} />
        ) : null}
        {state.data?.length ? (
          <div className="card-list">
            {state.data.map((report) => (
              <article className="list-card" key={report.id}>
                <strong>{report.title}</strong>
                <span>{report.feedbackType.replaceAll("_", " ")}</span>
                <span>{report.status.replaceAll("_", " ")}</span>
                <p className="muted">{report.message}</p>
              </article>
            ))}
          </div>
        ) : !state.isLoading && !state.error ? (
          <EmptyState
            title="No feedback submitted yet"
            description="Reports you submit during the beta will show up here."
          />
        ) : null}
      </section>
    </section>
  );
}

function FeedbackForm({
  initialType,
  linkedRecommendationEventId,
  linkedTransactionId,
  linkedOutcomeId,
  onSubmitted,
}: {
  initialType: FeedbackType;
  linkedRecommendationEventId?: string;
  linkedTransactionId?: string;
  linkedOutcomeId?: string;
  onSubmitted?: () => void;
}) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialType);
  const [severity, setSeverity] = useState<FeedbackSeverity>("MEDIUM");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    if (!title.trim() || !message.trim()) {
      setError("Title and message are required.");
      return;
    }
    try {
      const body: Parameters<typeof apiClient.submitFeedback>[0] = {
        feedbackType,
        severity,
        title: title.trim(),
        message: message.trim(),
        pageUrl: window.location.href,
        context: { pathname: window.location.pathname },
      };
      if (linkedRecommendationEventId) {
        body.linkedRecommendationEventId = linkedRecommendationEventId;
      }
      if (linkedTransactionId) body.linkedTransactionId = linkedTransactionId;
      if (linkedOutcomeId) body.linkedOutcomeId = linkedOutcomeId;
      await apiClient.submitFeedback(body);
      setTitle("");
      setMessage("");
      setStatus("Thanks, your feedback was sent.");
      onSubmitted?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Type
        <select
          value={feedbackType}
          onChange={(event) =>
            setFeedbackType(event.target.value as FeedbackType)
          }
        >
          {feedbackTypes.map((type) => (
            <option key={type} value={type}>
              {type.replaceAll("_", " ")}
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
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        Message
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      {linkedRecommendationEventId ? (
        <p className="muted">
          Attached recommendation {linkedRecommendationEventId}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {status ? <p className="success-message">{status}</p> : null}
      <button type="submit">Submit feedback</button>
    </form>
  );
}
