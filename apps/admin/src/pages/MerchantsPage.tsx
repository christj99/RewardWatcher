import { Link } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock } from "./pageUtils";

export function MerchantsPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listMerchants(), [api]);

  return (
    <>
      <PageHeader
        title="Merchants"
        description="Merchant categories, URL patterns, and posting profiles."
        actions={
          <Link className="button" to="/merchants/new">
            Create merchant
          </Link>
        }
      />
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<any>(data)}
            columns={[
              {
                header: "Merchant",
                render: (row) => (
                  <Link to={`/merchants/${row.id}`}>{row.name}</Link>
                ),
              },
              { header: "Slug", render: (row) => row.slug },
              {
                header: "Category",
                render: (row) => <StatusBadge value={row.category} />,
              },
              {
                header: "Website",
                render: (row) =>
                  row.websiteUrl ? (
                    <a href={row.websiteUrl}>{row.websiteUrl}</a>
                  ) : (
                    "n/a"
                  ),
              },
              {
                header: "URL patterns",
                render: (row) =>
                  row._count?.urlPatterns ?? row.urlPatternCount ?? "n/a",
              },
              {
                header: "Posting profiles",
                render: (row) =>
                  row._count?.postingProfiles ??
                  row.postingProfileCount ??
                  "n/a",
              },
            ]}
          />
        )}
      </AsyncBlock>
    </>
  );
}
