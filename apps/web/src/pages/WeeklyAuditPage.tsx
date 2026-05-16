import { useState, type FormEvent } from "react";

import { apiClient } from "../api/client.js";
import { ConfidenceBadge } from "../components/ConfidenceBadge.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { MoneyValue, dollarsToCents } from "../components/MoneyValue.js";
import { OutcomeBadge } from "../components/OutcomeBadge.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

export function WeeklyAuditPage() {
  const defaults = defaultRange();
  const [weekStart, setWeekStart] = useState(defaults.start);
  const [weekEnd, setWeekEnd] = useState(defaults.end);
  const [threshold, setThreshold] = useState("1.00");
  const [includeInconclusive, setIncludeInconclusive] = useState(false);
  const [includeUnmatched, setIncludeUnmatched] = useState(true);
  const [submitted, setSubmitted] = useState(0);
  const state = useAsync(
    () =>
      apiClient.getWeeklyAudit({
        weekStart: new Date(weekStart).toISOString(),
        weekEnd: new Date(weekEnd).toISOString(),
        minMissedValueCents: dollarsToCents(threshold) ?? 100,
        includeInconclusive,
        includeUnmatched,
        limitItems: 50,
      }),
    [submitted],
  );

  function apply(event: FormEvent) {
    event.preventDefault();
    setSubmitted((current) => current + 1);
  }

  return (
    <section>
      <PageHeader
        title="Weekly Audit"
        description="A deterministic summary of persisted audit outcomes."
      />
      <section className="panel">
        <form className="form-grid compact" onSubmit={apply}>
          <label>
            Start date
            <input
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={weekEnd}
              onChange={(event) => setWeekEnd(event.target.value)}
            />
          </label>
          <label>
            Meaningful miss threshold
            <input
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeInconclusive}
              onChange={(event) => setIncludeInconclusive(event.target.checked)}
            />{" "}
            Include inconclusive
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeUnmatched}
              onChange={(event) => setIncludeUnmatched(event.target.checked)}
            />{" "}
            Include unmatched
          </label>
          <button type="submit">Update report</button>
        </form>
      </section>
      {state.isLoading ? <LoadingState label="Loading weekly audit" /> : null}
      {state.error ? (
        <ErrorState message={state.error} onRetry={state.reload} />
      ) : null}
      {state.data ? (
        <div>
          <div className="metric-grid">
            <Metric
              label="Captured value"
              cents={state.data.estimatedValueCapturedCents}
            />
            <Metric
              label="Missed value"
              cents={state.data.estimatedValueMissedCents}
            />
            <Metric
              label="Meaningful missed value"
              cents={state.data.meaningfulMissedValueCents}
            />
            <Metric
              label="Meaningful misses"
              value={state.data.meaningfulMissCount}
            />
          </div>
          <section className="panel">
            <h2>Summary</h2>
            <dl className="detail-list">
              <div>
                <dt>Captured optimal</dt>
                <dd>{state.data.capturedOptimalCount}</dd>
              </div>
              <div>
                <dt>Recommendation errors</dt>
                <dd>{state.data.recommendationErrorCount}</dd>
              </div>
              <div>
                <dt>Inconclusive</dt>
                <dd>{state.data.inconclusiveCount}</dd>
              </div>
              <div>
                <dt>Unmatched</dt>
                <dd>{state.data.unmatchedCount}</dd>
              </div>
            </dl>
            {state.data.topMiss ? (
              <article className="list-card">
                <h3>Top miss: {state.data.topMiss.merchantName}</h3>
                <p>{state.data.topMiss.actionText}</p>
                <MoneyValue cents={state.data.topMiss.missedValueCents} />
              </article>
            ) : null}
            {state.data.recommendedAction ? (
              <p className="callout">{state.data.recommendedAction}</p>
            ) : null}
            <ul className="warning-list">
              {state.data.confidenceNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>Items</h2>
            {state.data.items.length === 0 ? (
              <EmptyState
                title="No report items"
                description="Import transactions or request recommendations before purchases to generate a useful audit."
              />
            ) : (
              <div className="card-list">
                {state.data.items.map((item) => (
                  <article className="list-card" key={item.outcomeId}>
                    <div className="split">
                      <OutcomeBadge type={item.outcomeType} />
                      <ConfidenceBadge level={item.confidence} />
                    </div>
                    <strong>{item.merchantName}</strong>
                    <span>
                      {new Date(item.transactionDate).toLocaleDateString()}
                    </span>
                    <span>
                      Actual: {item.actualCard?.name ?? "Unknown card"}
                    </span>
                    <span>Best: {item.bestCard?.name ?? "Unknown card"}</span>
                    <span>
                      Captured: <MoneyValue cents={item.capturedValueCents} />
                    </span>
                    <span>
                      Missed: <MoneyValue cents={item.missedValueCents} />
                    </span>
                    <p>{item.actionText}</p>
                    <p className="muted">{item.explanation}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  cents,
  value,
}: {
  label: string;
  cents?: number;
  value?: number;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {cents !== undefined ? <MoneyValue cents={cents} /> : value}
      </strong>
    </div>
  );
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return { start: toDateInput(start), end: toDateInput(end) };
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}
