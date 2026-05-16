import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { JsonDetails } from "../components/JsonDetails";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock, objectName } from "./pageUtils";

export function AuditLogsPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.getAdminAuditLogs(), [api]);

  return (
    <>
      <PageHeader
        title="Admin Audit Logs"
        description="Redacted record of admin mutations to shared rewards data and review work."
      />
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<any>(data)}
            columns={[
              {
                header: "Created",
                render: (row) => <DateTime value={row.createdAt} />,
              },
              { header: "Admin", render: (row) => objectName(row.adminUser) },
              {
                header: "Action",
                render: (row) => <StatusBadge value={row.action} />,
              },
              {
                header: "Entity",
                render: (row) => `${row.entityType} ${row.entityId ?? ""}`,
              },
              {
                header: "Details",
                render: (row) => (
                  <>
                    <JsonDetails title="Before" value={row.before} />
                    <JsonDetails title="After" value={row.after} />
                    <JsonDetails title="Metadata" value={row.metadata} />
                  </>
                ),
              },
            ]}
          />
        )}
      </AsyncBlock>
    </>
  );
}
