import { useState } from "react";

import { apiClient } from "../api/client.js";
import type { StatementCreditUsage } from "../api/types.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { MoneyValue } from "../components/MoneyValue.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

export function CreditsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const state = useAsync(() => apiClient.getStatementCreditUsage(), []);

  async function generateUsage() {
    const result = await apiClient.generateStatementCreditUsage({
      inferFromTransactions: true,
    });
    setMessage(
      `Generated ${result.generatedCount}, updated ${result.updatedCount}.`,
    );
    state.reload();
  }

  async function updateStatus(
    usage: StatementCreditUsage,
    status: StatementCreditUsage["status"],
  ) {
    await apiClient.updateStatementCreditUsage(usage.id, { status });
    state.reload();
  }

  if (state.isLoading) return <LoadingState label="Loading credits" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        message={state.error ?? "Statement credit usage unavailable."}
        onRetry={state.reload}
      />
    );
  }

  return (
    <section>
      <PageHeader
        title="Credits"
        description="Estimate recurring statement credit usage from matching transactions. Treat these as cautious signals, not issuer-confirmed credits."
      />
      <div className="action-list">
        <button className="button" type="button" onClick={generateUsage}>
          Generate usage
        </button>
      </div>
      {message ? <p className="callout">{message}</p> : null}

      {state.data.length === 0 ? (
        <EmptyState
          title="No credit usage records yet"
          description="Generate estimated usage after importing or syncing transactions."
        />
      ) : (
        <section className="panel">
          <h2>Statement credit usage</h2>
          <div className="stack">
            {state.data.map((usage) => (
              <article className="list-card" key={usage.id}>
                <strong>{usage.statementCredit.name}</strong>
                <p>
                  {usage.userCard?.card.name ?? "Unknown card"} ·{" "}
                  {new Date(usage.periodStart).toLocaleDateString()} to{" "}
                  {new Date(usage.periodEnd).toLocaleDateString()}
                </p>
                <dl className="detail-list">
                  <div>
                    <dt>Status</dt>
                    <dd>{usage.status.replaceAll("_", " ")}</dd>
                  </div>
                  <div>
                    <dt>Estimated used</dt>
                    <dd>
                      <MoneyValue cents={usage.amountUsedCents} />
                    </dd>
                  </div>
                  <div>
                    <dt>Estimated remaining</dt>
                    <dd>
                      <MoneyValue cents={usage.estimatedRemainingCents} />
                    </dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{usage.source.replaceAll("_", " ")}</dd>
                  </div>
                </dl>
                <p className="muted">
                  Estimated from matching transactions; this does not prove the
                  issuer posted a statement credit.
                </p>
                <div className="action-list">
                  {(
                    ["USED", "PARTIALLY_USED", "UNUSED", "UNKNOWN"] as const
                  ).map((status) => (
                    <button
                      className="button secondary"
                      key={status}
                      type="button"
                      onClick={() => updateStatus(usage, status)}
                    >
                      Mark {status.toLowerCase().replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
