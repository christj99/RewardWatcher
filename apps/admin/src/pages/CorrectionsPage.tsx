import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock, cardName, merchantName } from "./pageUtils";

export function CorrectionsPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listCorrections(), [api]);

  async function update(id: string, status: string) {
    await api.updateCorrection(id, {
      status,
      resolutionNotes: `Set ${status} from admin UI.`,
    });
    await state.reload();
  }

  return (
    <>
      <PageHeader
        title="Corrections"
        description="User-submitted correction signals and curator resolution."
      />
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<any>(data)}
            columns={[
              {
                header: "Type",
                render: (row) => <StatusBadge value={row.correctionType} />,
              },
              {
                header: "Status",
                render: (row) => <StatusBadge value={row.status} />,
              },
              {
                header: "User note",
                render: (row) => row.userNote ?? row.note ?? "n/a",
              },
              {
                header: "Merchant",
                render: (row) => merchantName(row.recommendationEvent ?? row),
              },
              {
                header: "Card",
                render: (row) => cardName(row.recommendationEvent ?? row),
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
                      onClick={() => void update(row.id, "RESOLVED")}
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void update(row.id, "REJECTED")}
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
