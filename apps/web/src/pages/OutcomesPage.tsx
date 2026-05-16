import { useState } from "react";

import { apiClient } from "../api/client.js";
import type { OutcomeType } from "../api/types.js";
import { ConfidenceBadge } from "../components/ConfidenceBadge.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { MerchantSummary } from "../components/MerchantSummary.js";
import { MoneyValue } from "../components/MoneyValue.js";
import { OutcomeBadge } from "../components/OutcomeBadge.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

const outcomeTypes: OutcomeType[] = [
  "CAPTURED_OPTIMAL",
  "USER_MISSED_VALUE",
  "RECOMMENDATION_ERROR",
  "UNMATCHED",
  "USER_OVERRIDE",
  "INCONCLUSIVE",
];

export function OutcomesPage() {
  const [outcomeType, setOutcomeType] = useState("");
  const state = useAsync(
    () =>
      apiClient.getOutcomes({
        limit: 50,
        outcomeType: outcomeType || undefined,
      }),
    [outcomeType],
  );

  if (state.isLoading) return <LoadingState label="Loading outcomes" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        message={state.error ?? "Could not load outcomes."}
        onRetry={state.reload}
      />
    );
  }

  return (
    <section>
      <PageHeader
        title="Outcomes"
        description="The audit result for imported transactions."
      />
      <section className="panel">
        <label>
          Outcome filter
          <select
            value={outcomeType}
            onChange={(event) => setOutcomeType(event.target.value)}
          >
            <option value="">All outcomes</option>
            {outcomeTypes.map((type) => (
              <option value={type} key={type}>
                {type.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </section>
      {state.data.length === 0 ? (
        <EmptyState
          title="No outcomes yet"
          description="Import and audit a transaction to see value captured or missed."
          actionHref="/transactions/import"
          actionLabel="Import transaction"
        />
      ) : (
        <div className="card-list">
          {state.data.map((outcome) => (
            <article className="list-card" key={outcome.id}>
              <div className="split">
                <OutcomeBadge type={outcome.outcomeType} />
                <ConfidenceBadge level={outcome.confidence} />
              </div>
              <strong>
                <MerchantSummary merchant={outcome.transaction?.merchant} />
              </strong>
              <span>
                Actual:{" "}
                {outcome.actualUserCard?.nickname ||
                  outcome.actualUserCard?.card.name ||
                  "Unknown card"}
              </span>
              <span>
                Best:{" "}
                {outcome.bestUserCard?.nickname ||
                  outcome.bestUserCard?.card.name ||
                  "Unknown card"}
              </span>
              <span>
                Missed value: <MoneyValue cents={outcome.missedValueCents} />
              </span>
              <p>{outcome.explanation}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
