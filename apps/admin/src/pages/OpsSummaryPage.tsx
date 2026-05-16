import { Link } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { JsonDetails } from "../components/JsonDetails";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import type { AdminDiagnostics, AdminOpsSummary } from "../api/types";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { AsyncBlock } from "./pageUtils";

export function OpsSummaryPage() {
  const api = useAdminApi();
  const state = useAsync(async () => {
    const [summary, diagnostics] = await Promise.all([
      api.getOpsSummary(),
      api.getDiagnostics(),
    ]);
    return {
      summary: summary as AdminOpsSummary,
      diagnostics: diagnostics as AdminDiagnostics,
    };
  }, [api]);

  return (
    <>
      <PageHeader
        title="Ops Summary"
        description="Deployment health, recent failures, and safe diagnostics."
      />
      <AsyncBlock state={state}>
        {({ summary, diagnostics }) => (
          <div className="stack">
            <div className="grid">
              <Metric label="Database" value={diagnostics.database} />
              <Metric
                label="Scheduler"
                value={diagnostics.schedulerEnabled ? "enabled" : "disabled"}
              />
              <Metric
                label="Job failures / 24h"
                value={summary.recentJobFailures}
              />
              <Metric
                label="Email failures / 24h"
                value={summary.recentEmailFailures}
              />
              <Metric
                label="Plaid failures / 24h"
                value={summary.recentPlaidFailures}
              />
              <Metric
                label="Stripe webhook failures / 24h"
                value={summary.recentStripeWebhookFailures}
              />
              <Metric
                label="Recommendation errors / 7d"
                value={summary.recommendationErrorsLast7Days}
              />
              <Metric
                label="High priority review tasks"
                value={summary.openHighPriorityReviewTasks}
              />
            </div>

            <section className="panel">
              <h2>System</h2>
              <p className="muted">
                Version {diagnostics.version} · {diagnostics.appEnv} · uptime{" "}
                {diagnostics.uptimeSeconds}s
              </p>
              <JsonDetails title="Safe diagnostics" value={diagnostics} />
            </section>

            <section className="panel">
              <h2>Latest Job Failures</h2>
              <DataTable
                columns={[
                  { header: "Job", render: (failure) => failure.jobName },
                  {
                    header: "Started",
                    render: (failure) =>
                      new Date(failure.startedAt).toLocaleString(),
                  },
                  {
                    header: "Error",
                    render: (failure) =>
                      failure.errorMessage ?? "Unknown error",
                  },
                  {
                    header: "Run",
                    render: () => <Link to="/jobs">Open jobs</Link>,
                  },
                ]}
                rows={summary.latestJobFailures ?? []}
                emptyTitle="No recent job failures."
              />
            </section>
          </div>
        )}
      </AsyncBlock>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {typeof value === "string" ? <StatusBadge value={value} /> : value}
      </strong>
    </div>
  );
}
