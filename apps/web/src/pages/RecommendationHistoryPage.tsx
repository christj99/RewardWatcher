import { Link } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { ConfidenceBadge } from "../components/ConfidenceBadge.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { MerchantSummary } from "../components/MerchantSummary.js";
import { MoneyValue } from "../components/MoneyValue.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

export function RecommendationHistoryPage() {
  const state = useAsync(
    () => apiClient.getRecommendationHistory({ limit: 50 }),
    [],
  );

  if (state.isLoading) return <LoadingState label="Loading recommendations" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        message={state.error ?? "Could not load recommendations."}
        onRetry={state.reload}
      />
    );
  }

  return (
    <section>
      <PageHeader
        title="Recommendation History"
        description="Saved receipts explain what was recommended and why."
      />
      {state.data.length === 0 ? (
        <EmptyState
          title="No recommendation receipts yet"
          description="Look up a merchant to create the first receipt."
          actionHref="/lookup"
          actionLabel="Look up merchant"
        />
      ) : (
        <div className="card-list">
          {state.data.map((item) => (
            <Link
              className="list-card linked-card"
              to={`/recommendations/${item.id}`}
              key={item.id}
            >
              <div className="split">
                <strong>
                  <MerchantSummary merchant={item.merchant} />
                </strong>
                <ConfidenceBadge level={item.confidence} />
              </div>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
              <span>
                {item.recommendedCard?.name ?? "Unknown card"} for{" "}
                {item.expectedCategory.replace("_", " ")}
              </span>
              <span>
                Expected value: <MoneyValue cents={item.expectedValueCents} />
              </span>
              <p>{item.explanation}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
