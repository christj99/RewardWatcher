import { Link } from "react-router-dom";

import { ConfirmButton } from "../components/ConfirmButton";
import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock, objectName } from "./pageUtils";

export function EarningRulesPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listEarningRules(), [api]);

  async function retire(id: string) {
    await api.retireEarningRule(id, { notes: "Retired from admin UI." });
    await state.reload();
  }

  return (
    <>
      <PageHeader
        title="Earning Rules"
        description="Structured deterministic earning rules with source, confidence, caps, and active dates."
        actions={
          <Link className="button" to="/earning-rules/new">
            Create rule
          </Link>
        }
      />
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<any>(data)}
            columns={[
              { header: "Card", render: (row) => objectName(row.card) },
              {
                header: "Scope",
                render: (row) => row.merchant?.name ?? row.category ?? "Base",
              },
              { header: "Multiplier", render: (row) => String(row.multiplier) },
              {
                header: "Cap",
                render: (row) =>
                  row.capAmountCents
                    ? `${row.capAmountCents} / ${row.capPeriod}`
                    : "n/a",
              },
              {
                header: "Activation",
                render: (row) => (
                  <StatusBadge
                    value={row.activationRequired ? "Required" : "No"}
                  />
                ),
              },
              {
                header: "Confidence",
                render: (row) => <StatusBadge value={row.confidence} />,
              },
              {
                header: "Source verified",
                render: (row) => <DateTime value={row.source?.verifiedAt} />,
              },
              {
                header: "Active",
                render: (row) => (
                  <>
                    <DateTime value={row.startsAt} /> to{" "}
                    <DateTime value={row.endsAt} />
                  </>
                ),
              },
              {
                header: "Actions",
                render: (row) => (
                  <span className="inline-actions">
                    <Link to={`/earning-rules/${row.id}/edit`}>Edit</Link>
                    <ConfirmButton onConfirm={() => void retire(row.id)}>
                      Retire
                    </ConfirmButton>
                  </span>
                ),
              },
            ]}
          />
        )}
      </AsyncBlock>
    </>
  );
}
