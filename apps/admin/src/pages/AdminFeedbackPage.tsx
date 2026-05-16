import { Link } from "react-router-dom";

import type { AdminFeedbackReport } from "../api/types";
import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock } from "./pageUtils";

export function AdminFeedbackPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listAdminFeedback(), [api]);

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Private beta reports tied to product context without raw sensitive payloads."
      />
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<AdminFeedbackReport>(data)}
            emptyTitle="No feedback reports yet."
            columns={[
              {
                header: "Created",
                render: (row) => <DateTime value={row.createdAt} />,
              },
              { header: "User", render: (row) => row.user?.email ?? "Unknown" },
              {
                header: "Type",
                render: (row) => row.feedbackType.replaceAll("_", " "),
              },
              {
                header: "Severity",
                render: (row) => <StatusBadge value={row.severity} />,
              },
              {
                header: "Status",
                render: (row) => <StatusBadge value={row.status} />,
              },
              {
                header: "Title",
                render: (row) => (
                  <Link to={`/feedback/${row.id}`}>{row.title}</Link>
                ),
              },
            ]}
          />
        )}
      </AsyncBlock>
    </>
  );
}
