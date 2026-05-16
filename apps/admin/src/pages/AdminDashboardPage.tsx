import { Link } from "react-router-dom";

import { MoneyValue } from "../components/MoneyValue";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { AsyncBlock } from "./pageUtils";

export function AdminDashboardPage() {
  const api = useAdminApi();
  const state = useAsync(async () => {
    const [reviewWork, freshness, errors, killTest] = await Promise.all([
      api.getOpenReviewWork(),
      api.getRuleFreshness(),
      api.getRecommendationErrors(),
      api.getKillTest(),
    ]);
    return {
      reviewWork: reviewWork as any,
      freshness: freshness as any,
      errors: errors as any,
      killTest: killTest as any,
    };
  }, [api]);

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Curation health, review work, recommendation errors, and kill-test posture."
      />
      <AsyncBlock state={state}>
        {({ reviewWork, freshness, errors, killTest }) => (
          <div className="grid">
            <Metric
              label="Open review tasks"
              value={reviewWork.openReviewTasks ?? 0}
              to="/review-tasks"
            />
            <Metric
              label="High priority tasks"
              value={reviewWork.highPriorityReviewTasks ?? 0}
              to="/review-tasks"
            />
            <Metric
              label="Open corrections"
              value={reviewWork.openCorrections ?? 0}
              to="/corrections"
            />
            <Metric
              label="Stale earning rules"
              value={(freshness.staleRules ?? []).length}
              to="/rule-freshness"
            />
            <Metric
              label="Missing-source rules"
              value={(freshness.missingSourceRules ?? []).length}
              to="/rule-freshness"
            />
            <Metric
              label="Recommendation errors"
              value={errors.totalRecommendationErrors ?? 0}
              to="/recommendation-errors"
            />
            <div className="metric">
              <span>Kill-test result</span>
              <strong>
                <StatusBadge
                  value={
                    killTest.metrics?.passFail?.overallPass ? "PASS" : "FAIL"
                  }
                />
              </strong>
              <p className="muted">
                {Number(
                  killTest.metrics?.percentUsersWithMeaningfulMiss ?? 0,
                ).toFixed(1)}
                % users with meaningful miss
              </p>
              <Link to="/kill-test">Open report</Link>
            </div>
            <div className="metric">
              <span>Meaningful missed value</span>
              <strong>
                <MoneyValue
                  cents={killTest.metrics?.totalMeaningfulMissedValueCents ?? 0}
                />
              </strong>
              <Link to="/kill-test">Review kill test</Link>
            </div>
          </div>
        )}
      </AsyncBlock>
    </>
  );
}

function Metric({
  label,
  value,
  to,
}: {
  label: string;
  value: number;
  to: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <Link to={to}>Review</Link>
    </div>
  );
}
