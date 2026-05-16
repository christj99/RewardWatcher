import type { AdminEmailLog } from "../api/types";
import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { JsonDetails } from "../components/JsonDetails";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock } from "./pageUtils";

export function EmailLogsPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.getAdminEmailLogs(), [api]);

  return (
    <>
      <PageHeader
        title="Email Logs"
        description="Redacted transactional email delivery records."
      />
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<AdminEmailLog>(data)}
            columns={[
              {
                header: "Created",
                render: (row) => <DateTime value={row.createdAt} />,
              },
              { header: "Recipient", render: (row) => row.toEmailRedacted },
              { header: "Type", render: (row) => row.emailType },
              {
                header: "Status",
                render: (row) => <StatusBadge value={row.status} />,
              },
              { header: "Subject", render: (row) => row.subject },
              { header: "Provider", render: (row) => row.provider },
              {
                header: "Sent",
                render: (row) =>
                  row.sentAt ? <DateTime value={row.sentAt} /> : "Not sent",
              },
              {
                header: "Details",
                render: (row) => (
                  <>
                    {row.errorMessage ? (
                      <p className="form-error">{row.errorMessage}</p>
                    ) : null}
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
