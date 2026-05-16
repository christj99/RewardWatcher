import { useState, type FormEvent } from "react";

import type { BetaUserRow } from "../api/types";
import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock } from "./pageUtils";

export function BetaUsersPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listBetaUsers(), [api]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Beta Users"
        description="Milestones, stuck users, cohorts, tags, and internal support notes."
      />
      <AsyncBlock state={state}>
        {(data) => {
          const users = asArray<BetaUserRow>(data);
          const selected = users.find((user) => user.id === selectedUserId);
          return (
            <div className="stack">
              <DataTable
                rows={users}
                emptyTitle="No beta users yet."
                columns={[
                  { header: "User", render: (row) => row.email },
                  {
                    header: "Status",
                    render: (row) => (
                      <StatusBadge value={row.betaProfile?.status ?? "NONE"} />
                    ),
                  },
                  {
                    header: "Cohort",
                    render: (row) => row.betaProfile?.cohort?.name ?? "None",
                  },
                  {
                    header: "Recommendations",
                    render: (row) => row.milestones.recommendationCount,
                  },
                  {
                    header: "Audits",
                    render: (row) => row.milestones.transactionAuditCount,
                  },
                  {
                    header: "Feedback",
                    render: (row) => row.milestones.feedbackCount,
                  },
                  {
                    header: "Last event",
                    render: (row) =>
                      row.milestones.lastActiveAt ? (
                        <DateTime value={row.milestones.lastActiveAt} />
                      ) : (
                        "None"
                      ),
                  },
                  {
                    header: "Support",
                    render: (row) => (
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(row.id)}
                      >
                        Open
                      </button>
                    ),
                  },
                ]}
              />
              {selected ? (
                <section className="panel">
                  <h2>{selected.email}</h2>
                  <BetaUserEdit user={selected} onSaved={state.reload} />
                  <SupportNotes userId={selected.id} />
                </section>
              ) : null}
            </div>
          );
        }}
      </AsyncBlock>
    </>
  );
}

type BetaProfileStatus = NonNullable<BetaUserRow["betaProfile"]>["status"];

function BetaUserEdit({
  user,
  onSaved,
}: {
  user: BetaUserRow;
  onSaved: () => void;
}) {
  const api = useAdminApi();
  const [status, setStatus] = useState<BetaProfileStatus>(
    user.betaProfile?.status ?? "INVITED",
  );
  const [notes, setNotes] = useState(user.betaProfile?.notes ?? "");
  const [tags, setTags] = useState(user.betaProfile?.tags.join(", ") ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.updateBetaUser(user.id, {
      status,
      notes: notes || null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    onSaved();
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Status
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as BetaProfileStatus)
          }
        >
          {["INVITED", "ACTIVE", "STUCK", "CHURNED", "PAUSED"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tags
        <input value={tags} onChange={(event) => setTags(event.target.value)} />
      </label>
      <label>
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <button type="submit">Save beta profile</button>
    </form>
  );
}

function SupportNotes({ userId }: { userId: string }) {
  const api = useAdminApi();
  const notes = useAsync(() => api.listSupportNotes(userId), [api, userId]);
  const [note, setNote] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    await api.createSupportNote(userId, { note: note.trim() });
    setNote("");
    notes.reload();
  }

  return (
    <div className="stack">
      <h3>Support notes</h3>
      <form className="form-row" onSubmit={submit}>
        <input value={note} onChange={(event) => setNote(event.target.value)} />
        <button type="submit">Add note</button>
      </form>
      <AsyncBlock state={notes}>
        {(data) => (
          <div className="card-list">
            {asArray<{ id: string; note: string; createdAt: string }>(data).map(
              (item) => (
                <article className="list-card" key={item.id}>
                  <p>{item.note}</p>
                  <DateTime value={item.createdAt} />
                </article>
              ),
            )}
          </div>
        )}
      </AsyncBlock>
    </div>
  );
}
