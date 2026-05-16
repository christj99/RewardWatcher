import { Link } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { MoneyValue } from "../components/MoneyValue.js";
import { OutcomeBadge } from "../components/OutcomeBadge.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

export function DashboardPage() {
  const state = useAsync(async () => {
    const [user, wallet, recommendations, transactions, weekly, offers] =
      await Promise.all([
        apiClient.getCurrentUser(),
        apiClient.getWallet(),
        apiClient.getRecommendationHistory({ limit: 5 }),
        apiClient.getTransactions({ limit: 5 }),
        apiClient.getWeeklyAudit({ limitItems: 5 }),
        apiClient.getOffers({ limit: 5 }),
      ]);
    return { user, wallet, recommendations, transactions, weekly, offers };
  }, []);

  if (state.isLoading) return <LoadingState label="Loading dashboard" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        message={state.error ?? "Dashboard unavailable."}
        onRetry={state.reload}
      />
    );
  }

  const { user, wallet, recommendations, transactions, weekly, offers } =
    state.data;

  return (
    <section>
      <PageHeader
        title={`Welcome${user.displayName ? `, ${user.displayName}` : ""}`}
        description="Recommend a card, keep the receipt, import what posted, then audit the result."
      />

      <div className="metric-grid">
        <Metric label="Wallet cards" value={wallet.length} />
        <Metric label="Recent recommendations" value={recommendations.length} />
        <Metric label="Recent transactions" value={transactions.length} />
        <Metric
          label="Weekly meaningful misses"
          value={<MoneyValue cents={weekly.meaningfulMissedValueCents} />}
        />
        <Metric
          label="Wallet actions"
          value={
            (weekly.walletActions?.overdueReminderCount ?? 0) +
            (weekly.walletActions?.dueSoonReminderCount ?? 0) +
            (weekly.walletActions?.unusedStatementCreditCount ?? 0)
          }
        />
        <Metric label="Relevant offers" value={offers.length} />
      </div>

      <div className="panel-grid">
        <section className="panel">
          <h2>Weekly Audit Preview</h2>
          <dl className="detail-list">
            <div>
              <dt>Captured value</dt>
              <dd>
                <MoneyValue cents={weekly.estimatedValueCapturedCents} />
              </dd>
            </div>
            <div>
              <dt>Meaningful missed value</dt>
              <dd>
                <MoneyValue cents={weekly.meaningfulMissedValueCents} />
              </dd>
            </div>
          </dl>
          {weekly.topMiss ? (
            <article className="list-card">
              <OutcomeBadge type={weekly.topMiss.outcomeType} />
              <h3>{weekly.topMiss.merchantName}</h3>
              <p>{weekly.topMiss.actionText}</p>
            </article>
          ) : (
            <EmptyState
              title="No meaningful miss found yet"
              description="Import posted transactions to build a stronger audit trail."
              actionHref="/transactions/import"
              actionLabel="Import a transaction"
            />
          )}
          {weekly.recommendedAction ? (
            <p className="callout">{weekly.recommendedAction}</p>
          ) : null}
        </section>

        <section className="panel">
          <h2>Next Actions</h2>
          {weekly.walletActions?.topAction ? (
            <article className="list-card">
              <strong>{weekly.walletActions.topAction.title}</strong>
              <p>{weekly.walletActions.topAction.description}</p>
              {weekly.walletActions.topAction.dueAt ? (
                <p>
                  Due{" "}
                  {new Date(
                    weekly.walletActions.topAction.dueAt,
                  ).toLocaleDateString()}
                </p>
              ) : null}
            </article>
          ) : null}
          <div className="action-list">
            {wallet.length === 0 ? (
              <Link className="button" to="/onboarding">
                Add cards
              </Link>
            ) : null}
            <Link className="button" to="/lookup">
              Look up merchant
            </Link>
            <Link className="button secondary" to="/transactions/import">
              Import transaction
            </Link>
            <Link className="button secondary" to="/audit/weekly">
              View weekly audit
            </Link>
            <Link className="button secondary" to="/reminders">
              View reminders
            </Link>
            <Link className="button secondary" to="/credits">
              View credits
            </Link>
            <Link className="button secondary" to="/offers">
              View offers
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
