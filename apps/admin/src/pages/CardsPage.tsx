import { Link } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { MoneyValue } from "../components/MoneyValue";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock, objectName } from "./pageUtils";

export function CardsPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listCards(), [api]);

  return (
    <>
      <PageHeader
        title="Cards"
        description="Manage issuer cards and inspect attached versions, rules, benefits, and credits."
        actions={
          <Link className="button" to="/cards/new">
            Create card
          </Link>
        }
      />
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<any>(data)}
            columns={[
              {
                header: "Card",
                render: (row) => (
                  <Link to={`/cards/${row.id}`}>{row.name}</Link>
                ),
              },
              { header: "Issuer", render: (row) => objectName(row.issuer) },
              { header: "Network", render: (row) => row.network ?? "n/a" },
              {
                header: "Annual fee",
                render: (row) => <MoneyValue cents={row.annualFeeCents} />,
              },
              {
                header: "Active",
                render: (row) => <StatusBadge value={row.isActive} />,
              },
              {
                header: "Rules",
                render: (row) =>
                  row._count?.earningRules ??
                  row.earningRuleCount ??
                  row.ruleCount ??
                  "n/a",
              },
              {
                header: "Versions",
                render: (row) =>
                  row._count?.versions ?? row.versionCount ?? "n/a",
              },
              {
                header: "Actions",
                render: (row) => <Link to={`/cards/${row.id}/edit`}>Edit</Link>,
              },
            ]}
          />
        )}
      </AsyncBlock>
    </>
  );
}
