import { Link, useParams } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { MoneyValue } from "../components/MoneyValue";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, objectName } from "./pageUtils";

export function CardDetailPage() {
  const { id } = useParams();
  const api = useAdminApi();
  const state = useAsync(() => api.getCard(id ?? ""), [api, id]);

  if (state.isLoading) return <LoadingState />;
  if (state.error)
    return <ErrorState error={state.error} onRetry={state.reload} />;
  const card = state.data as any;
  if (!card) return <ErrorState error="Card not found." />;

  return (
    <>
      <PageHeader
        title={card.name}
        description={`${objectName(card.issuer)} card detail and attached rewards data.`}
        actions={
          <Link className="button" to={`/cards/${card.id}/edit`}>
            Edit card
          </Link>
        }
      />
      <div className="grid">
        <section className="panel">
          <h2>Metadata</h2>
          <p>Issuer: {objectName(card.issuer)}</p>
          <p>Network: {card.network ?? "n/a"}</p>
          <p>
            Annual fee: <MoneyValue cents={card.annualFeeCents} />
          </p>
          <p>
            Status: <StatusBadge value={card.isActive} />
          </p>
        </section>
        <section className="panel">
          <h2>Activity</h2>
          <p>
            Recent recommendations: {card.recentRecommendationCount ?? "n/a"}
          </p>
          <p>Recent outcomes: {card.recentOutcomeCount ?? "n/a"}</p>
          <Link to={`/earning-rules/new?cardId=${card.id}`}>
            Add earning rule
          </Link>
        </section>
      </div>
      <section className="panel">
        <h2>Versions</h2>
        <DataTable
          rows={asArray<any>(card.versions)}
          columns={[
            { header: "Version", render: (row) => row.versionName },
            {
              header: "Effective from",
              render: (row) => <DateTime value={row.effectiveFrom} />,
            },
            {
              header: "Effective to",
              render: (row) => <DateTime value={row.effectiveTo} />,
            },
            {
              header: "Annual fee",
              render: (row) => <MoneyValue cents={row.annualFeeCents} />,
            },
          ]}
        />
      </section>
      <section className="panel">
        <h2>Earning rules</h2>
        <DataTable
          rows={asArray<any>(card.earningRules)}
          columns={[
            {
              header: "Scope",
              render: (row) => row.merchant?.name ?? row.category ?? "Base",
            },
            { header: "Multiplier", render: (row) => String(row.multiplier) },
            {
              header: "Confidence",
              render: (row) => <StatusBadge value={row.confidence} />,
            },
            {
              header: "Actions",
              render: (row) => (
                <Link to={`/earning-rules/${row.id}/edit`}>Edit</Link>
              ),
            },
          ]}
        />
      </section>
    </>
  );
}
