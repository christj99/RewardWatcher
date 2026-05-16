import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { MoneyValue } from "../components/MoneyValue";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { AsyncBlock, objectName } from "./pageUtils";

export function RecommendationErrorsPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.getRecommendationErrors(), [api]);

  return (
    <>
      <PageHeader
        title="Recommendation Errors"
        description="Persisted audit outcomes where the original recommendation appears wrong."
      />
      <AsyncBlock state={state}>
        {(data: any) => (
          <>
            <div className="grid">
              <div className="metric">
                <span>Total errors</span>
                <strong>{data.totalRecommendationErrors ?? 0}</strong>
              </div>
              <div className="metric">
                <span>Error rate among matched outcomes</span>
                <strong>
                  {((data.errorRateAmongMatchedOutcomes ?? 0) * 100).toFixed(1)}
                  %
                </strong>
              </div>
            </div>
            <section className="panel">
              <h2>Grouped by merchant</h2>
              <DataTable<any>
                rows={data.groupedByMerchant ?? []}
                columns={[
                  { header: "Merchant", render: (row) => row.merchantName },
                  { header: "Count", render: (row) => row.count },
                  {
                    header: "Missed value",
                    render: (row) => (
                      <MoneyValue cents={row.missedValueCents} />
                    ),
                  },
                ]}
              />
            </section>
            <section className="panel">
              <h2>Error items</h2>
              <DataTable<any>
                rows={data.items ?? []}
                columns={[
                  {
                    header: "Created",
                    render: (row) => (
                      <DateTime value={row.createdAt ?? row.computedAt} />
                    ),
                  },
                  {
                    header: "Merchant",
                    render: (row) =>
                      objectName(row.merchant ?? row.transaction?.merchant),
                  },
                  {
                    header: "Recommended",
                    render: (row) => objectName(row.recommendedCard),
                  },
                  { header: "Best", render: (row) => objectName(row.bestCard) },
                  {
                    header: "Missed",
                    render: (row) => (
                      <MoneyValue cents={row.missedValueCents} />
                    ),
                  },
                  {
                    header: "Confidence",
                    render: (row) => <StatusBadge value={row.confidence} />,
                  },
                  { header: "Explanation", render: (row) => row.explanation },
                ]}
              />
            </section>
          </>
        )}
      </AsyncBlock>
    </>
  );
}
