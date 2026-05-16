import { Link } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { MerchantSummary } from "../components/MerchantSummary.js";
import { MoneyValue } from "../components/MoneyValue.js";
import { OutcomeBadge } from "../components/OutcomeBadge.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

export function TransactionsPage() {
  const state = useAsync(() => apiClient.getTransactions({ limit: 50 }), []);

  if (state.isLoading) return <LoadingState label="Loading transactions" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        message={state.error ?? "Could not load transactions."}
        onRetry={state.reload}
      />
    );
  }

  return (
    <section>
      <PageHeader
        title="Transactions"
        description="Posted transactions are the raw material for audit outcomes."
        actions={
          <Link className="button" to="/transactions/import">
            Import transaction
          </Link>
        }
      />
      {state.data.length === 0 ? (
        <EmptyState
          title="No transactions imported"
          description="Import a posted transaction to start closing the loop."
          actionHref="/transactions/import"
          actionLabel="Import transaction"
        />
      ) : (
        <div className="card-list">
          {state.data.map((transaction) => (
            <Link
              className="list-card linked-card"
              key={transaction.id}
              to={`/transactions/${transaction.id}`}
            >
              <div className="split">
                <strong>
                  <MerchantSummary merchant={transaction.merchant} />
                </strong>
                <MoneyValue cents={transaction.amountCents} />
              </div>
              <span>
                {new Date(transaction.transactionDate).toLocaleDateString()}
              </span>
              <span>
                {transaction.userCard?.nickname ||
                  transaction.userCard?.card.name ||
                  "Unknown card"}
              </span>
              <span>
                {transaction.observedCategory?.replace("_", " ") ??
                  "Unknown category"}
              </span>
              <OutcomeBadge
                type={
                  transaction.latestOutcome?.outcomeType ??
                  transaction.outcomes?.[0]?.outcomeType
                }
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
