import { Link } from "react-router-dom";

import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock } from "./pageUtils";

export function ReviewTasksPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listReviewTasks(), [api]);

  async function quickUpdate(id: string, status: string) {
    await api.updateReviewTask(id, { status });
    await state.reload();
  }

  return (
    <>
      <PageHeader
        title="Review Tasks"
        description="Triage curator review work from corrections and audits."
      />
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<any>(data)}
            columns={[
              {
                header: "Title",
                render: (row) => (
                  <Link to={`/review-tasks/${row.id}`}>
                    {row.title ?? row.id}
                  </Link>
                ),
              },
              {
                header: "Type",
                render: (row) => <StatusBadge value={row.taskType} />,
              },
              {
                header: "Priority",
                render: (row) => <StatusBadge value={row.priority} />,
              },
              {
                header: "Status",
                render: (row) => <StatusBadge value={row.status} />,
              },
              {
                header: "Correction",
                render: (row) =>
                  row.correction?.correctionType ?? row.correctionType ?? "n/a",
              },
              {
                header: "Created",
                render: (row) => <DateTime value={row.createdAt} />,
              },
              {
                header: "Actions",
                render: (row) => (
                  <span className="inline-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void quickUpdate(row.id, "IN_PROGRESS")}
                    >
                      Start
                    </button>
                    <button
                      type="button"
                      onClick={() => void quickUpdate(row.id, "RESOLVED")}
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void quickUpdate(row.id, "REJECTED")}
                    >
                      Reject
                    </button>
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
