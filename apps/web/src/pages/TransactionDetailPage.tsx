import { Link, useParams } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { errorMessage } from "../api/errors.js";
import { ConfidenceBadge } from "../components/ConfidenceBadge.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { MerchantSummary } from "../components/MerchantSummary.js";
import { MoneyValue } from "../components/MoneyValue.js";
import { OutcomeBadge } from "../components/OutcomeBadge.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";
import { useState } from "react";

export function TransactionDetailPage() {
  const { id } = useParams();
  const state = useAsync(() => apiClient.getTransaction(id ?? ""), [id]);
  const [error, setError] = useState<string | null>(null);

  if (!id) return <ErrorState message="Missing transaction id." />;
  if (state.isLoading) return <LoadingState label="Loading transaction" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        message={state.error ?? "Could not load transaction."}
        onRetry={state.reload}
      />
    );
  }

  const transactionId = id;

  async function audit() {
    setError(null);
    try {
      await apiClient.auditTransaction(transactionId);
      state.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const transaction = state.data;

  return (
    <section>
      <PageHeader
        title="Transaction Detail"
        description="Audit a posted transaction against prior recommendations."
      />
      <section className="panel">
        <dl className="detail-list">
          <div>
            <dt>Merchant</dt>
            <dd>
              <MerchantSummary merchant={transaction.merchant} />
            </dd>
          </div>
          <div>
            <dt>Raw merchant</dt>
            <dd>{transaction.rawMerchantName}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd>
              <MoneyValue cents={transaction.amountCents} />
            </dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>
              {new Date(transaction.transactionDate).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt>Card used</dt>
            <dd>
              {transaction.userCard?.nickname ||
                transaction.userCard?.card.name ||
                "Unknown card"}
            </dd>
          </div>
          <div>
            <dt>Observed category</dt>
            <dd>
              {transaction.observedCategory?.replace("_", " ") ?? "Unknown"}
            </dd>
          </div>
        </dl>
        {!transaction.userCard ? (
          <p className="muted">
            Missing card data may make this audit inconclusive.
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="button" onClick={() => void audit()}>
          Audit / Re-audit transaction
        </button>
        <Link
          to={`/feedback?transactionId=${encodeURIComponent(
            transactionId,
          )}&type=BUG`}
        >
          Report issue with this transaction
        </Link>
      </section>
      <section className="panel">
        <h2>Outcomes</h2>
        {transaction.outcomes?.length ? (
          <div className="card-list">
            {transaction.outcomes.map((outcome) => (
              <article className="list-card" key={outcome.id}>
                <OutcomeBadge type={outcome.outcomeType} />
                <ConfidenceBadge level={outcome.confidence} />
                <p>{outcome.explanation}</p>
                <span>
                  Missed value: <MoneyValue cents={outcome.missedValueCents} />
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No outcomes yet.</p>
        )}
      </section>
    </section>
  );
}
