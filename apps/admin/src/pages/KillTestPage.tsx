import { MoneyValue } from "../components/MoneyValue";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { AsyncBlock } from "./pageUtils";

export function KillTestPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.getKillTest(), [api]);

  return (
    <>
      <PageHeader
        title="Kill Test"
        description="Read-only internal evaluation of whether audited outcomes reveal enough meaningful value."
      />
      <AsyncBlock state={state}>
        {(data: any) => {
          const metrics = data.metrics ?? {};
          const passFail = metrics.passFail ?? {};
          return (
            <>
              <div className="grid">
                <div className="metric">
                  <span>Overall pass</span>
                  <strong>
                    <StatusBadge value={passFail.overallPass ? "YES" : "NO"} />
                  </strong>
                </div>
                <div className="metric">
                  <span>Users evaluated</span>
                  <strong>{metrics.totalUsersEvaluated ?? 0}</strong>
                </div>
                <div className="metric">
                  <span>Users with meaningful miss</span>
                  <strong>
                    {Number(
                      metrics.percentUsersWithMeaningfulMiss ?? 0,
                    ).toFixed(1)}
                    %
                  </strong>
                </div>
                <div className="metric">
                  <span>Meaningful missed value</span>
                  <strong>
                    <MoneyValue
                      cents={metrics.totalMeaningfulMissedValueCents ?? 0}
                    />
                  </strong>
                </div>
                <div className="metric">
                  <span>Recommendation error rate</span>
                  <strong>
                    {(
                      Number(metrics.recommendationErrorRate ?? 0) * 100
                    ).toFixed(1)}
                    %
                  </strong>
                </div>
                <div className="metric">
                  <span>Inconclusive rate</span>
                  <strong>
                    {(Number(metrics.inconclusiveRate ?? 0) * 100).toFixed(1)}%
                  </strong>
                </div>
              </div>
              <section className="panel">
                <h2>Reasons</h2>
                {(passFail.reasons ?? []).length ? (
                  <ul>
                    {passFail.reasons.map((reason: string) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No reasons returned.</p>
                )}
              </section>
            </>
          );
        }}
      </AsyncBlock>
    </>
  );
}
