import { useState, type FormEvent } from "react";

import type { BetaCohort } from "../api/types";
import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock } from "./pageUtils";

export function BetaCohortsPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listBetaCohorts(), [api]);

  return (
    <>
      <PageHeader
        title="Beta Cohorts"
        description="Simple cohorts for invite waves and launch learning."
      />
      <section className="panel">
        <h2>Create cohort</h2>
        <CohortForm onSaved={state.reload} />
      </section>
      <section className="panel">
        <h2>Cohorts</h2>
        <AsyncBlock state={state}>
          {(data) => (
            <DataTable
              rows={asArray<BetaCohort>(data)}
              emptyTitle="No beta cohorts yet."
              columns={[
                { header: "Name", render: (row) => row.name },
                { header: "Slug", render: (row) => row.slug },
                {
                  header: "Description",
                  render: (row) => row.description ?? "No description",
                },
              ]}
            />
          )}
        </AsyncBlock>
      </section>
    </>
  );
}

function CohortForm({ onSaved }: { onSaved: () => void }) {
  const api = useAdminApi();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.createBetaCohort({
      name,
      slug,
      description: description || null,
    });
    setName("");
    setSlug("");
    setDescription("");
    onSaved();
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Slug
        <input value={slug} onChange={(event) => setSlug(event.target.value)} />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <button type="submit">Create cohort</button>
    </form>
  );
}
