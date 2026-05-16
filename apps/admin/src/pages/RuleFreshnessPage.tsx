import { Link } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { AsyncBlock, objectName } from "./pageUtils";

export function RuleFreshnessPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.getRuleFreshness(), [api]);

  return (
    <>
      <PageHeader
        title="Rule Freshness"
        description="Stale, missing-source, and low-confidence rules that need curator attention."
      />
      <AsyncBlock state={state}>
        {(data: any) => (
          <>
            <RuleSection title="Stale rules" rows={data.staleRules ?? []} />
            <RuleSection
              title="Missing-source rules"
              rows={data.missingSourceRules ?? []}
            />
            <RuleSection
              title="Low-confidence rules"
              rows={data.lowConfidenceRules ?? []}
            />
          </>
        )}
      </AsyncBlock>
    </>
  );
}

function RuleSection({ title, rows }: { title: string; rows: any[] }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <DataTable
        rows={rows}
        columns={[
          { header: "Card", render: (row) => objectName(row.card) },
          {
            header: "Scope",
            render: (row) => objectName(row.merchant, row.category ?? "Base"),
          },
          {
            header: "Confidence",
            render: (row) => <StatusBadge value={row.confidence} />,
          },
          { header: "Source", render: (row) => objectName(row.source) },
          {
            header: "Source verified",
            render: (row) => (
              <DateTime
                value={row.sourceVerifiedAt ?? row.source?.verifiedAt}
              />
            ),
          },
          { header: "Age days", render: (row) => row.ageDays ?? "n/a" },
          {
            header: "Edit",
            render: (row) => (
              <Link to={`/earning-rules/${row.earningRuleId ?? row.id}/edit`}>
                Edit rule
              </Link>
            ),
          },
        ]}
      />
    </section>
  );
}
