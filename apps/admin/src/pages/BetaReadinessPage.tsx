import { Link } from "react-router-dom";

import type { BetaReadiness } from "../api/types";
import { DataTable } from "../components/DataTable";
import { JsonDetails } from "../components/JsonDetails";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { AsyncBlock } from "./pageUtils";

export function BetaReadinessPage() {
  const api = useAdminApi();
  const state = useAsync(
    async () => (await api.getBetaReadiness()) as BetaReadiness,
    [api],
  );

  return (
    <>
      <PageHeader
        title="Beta Readiness"
        description="Launch gate checklist for private beta operations."
      />
      <AsyncBlock state={state}>
        {(readiness) => (
          <div className="stack">
            <section className="panel">
              <div className="split-row">
                <div>
                  <h2>Launch Gate</h2>
                  <p className="muted">
                    Generated {new Date(readiness.generatedAt).toLocaleString()}
                  </p>
                </div>
                <strong>
                  <StatusBadge value={readiness.status} />
                </strong>
              </div>
              <div className="grid">
                <Metric
                  label="Database"
                  value={readiness.operations.databaseReady ? "ready" : "down"}
                />
                <Metric
                  label="Scheduler"
                  value={
                    readiness.config.schedulerEnabled ? "enabled" : "disabled"
                  }
                />
                <Metric
                  label="Job failures / 24h"
                  value={readiness.operations.recentJobFailures}
                />
                <Metric
                  label="Email failures / 24h"
                  value={readiness.operations.recentEmailFailures}
                />
                <Metric
                  label="High-priority tasks"
                  value={readiness.operations.openHighPriorityReviewTasks}
                />
                <Metric
                  label="Privacy requests"
                  value={readiness.operations.unresolvedPrivacyRequests}
                />
                <Metric
                  label="Open feedback"
                  value={readiness.operations.openFeedbackCount ?? 0}
                />
                <Metric
                  label="High/critical feedback"
                  value={readiness.operations.highCriticalFeedbackCount ?? 0}
                />
                <Metric
                  label="Stuck users"
                  value={readiness.operations.stuckBetaUsersCount ?? 0}
                />
                <Metric
                  label="Plaid-error users"
                  value={readiness.operations.usersWithPlaidErrors ?? 0}
                />
                <Metric
                  label="Beta users"
                  value={readiness.productHealth.activeBetaUsersCount}
                />
                <Metric
                  label="Active subscriptions"
                  value={readiness.productHealth.activeSubscriptionsCount}
                />
              </div>
            </section>

            <section className="panel">
              <h2>Checklist</h2>
              <DataTable
                rows={readiness.releaseChecklist}
                columns={[
                  {
                    header: "Status",
                    render: (item) => <StatusBadge value={item.status} />,
                  },
                  { header: "Launch check", render: (item) => item.label },
                  {
                    header: "Details",
                    render: (item) => item.details ?? "No details.",
                  },
                ]}
                emptyTitle="No launch checks returned."
              />
            </section>

            <section className="panel">
              <h2>Critical Flows</h2>
              <div className="grid">
                <FlowCard
                  title="Smoke commands"
                  body="Run API, user, admin, privacy, and job smoke checks against the target environment."
                  link="/jobs"
                  linkLabel="Open jobs"
                />
                <FlowCard
                  title="Operational signals"
                  body="Review recent job, email, Plaid, Stripe, and recommendation failures."
                  link="/ops"
                  linkLabel="Open ops"
                />
                <FlowCard
                  title="Review work"
                  body="Resolve or acknowledge high-priority review tasks before inviting users."
                  link="/review-tasks"
                  linkLabel="Open review tasks"
                />
                <FlowCard
                  title="Kill-test posture"
                  body="Use the kill-test page as a final trust gate before launch."
                  link="/kill-test"
                  linkLabel="Open kill test"
                />
              </div>
            </section>

            <section className="panel">
              <h2>Raw Safe Summary</h2>
              <JsonDetails value={readiness} />
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

function FlowCard({
  title,
  body,
  link,
  linkLabel,
}: {
  title: string;
  body: string;
  link: string;
  linkLabel: string;
}) {
  return (
    <article className="card">
      <h3>{title}</h3>
      <p className="muted">{body}</p>
      <Link to={link}>{linkLabel}</Link>
    </article>
  );
}
