import { useState } from "react";

import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { ErrorState } from "../components/ErrorState";
import { FormField } from "../components/FormField";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock, toIsoOrUndefined } from "./pageUtils";

export function RuleSourcesPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listRuleSources(), [api]);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    if (!form.get("title")) {
      setError("Title is required.");
      return;
    }
    await api.createRuleSource({
      sourceType: form.get("sourceType"),
      title: form.get("title"),
      url: String(form.get("url") ?? "").trim() || null,
      retrievedAt: toIsoOrUndefined(form.get("retrievedAt")) ?? null,
      verifiedAt: toIsoOrUndefined(form.get("verifiedAt")) ?? null,
      notes: String(form.get("notes") ?? "").trim() || null,
      createdBy: "admin-ui",
    });
    event.currentTarget.reset();
    await state.reload();
  }

  return (
    <>
      <PageHeader
        title="Rule Sources"
        description="Maintain source metadata and verified dates for rewards rules."
      />
      {error ? <ErrorState error={error} /> : null}
      <form
        className="panel form-grid"
        onSubmit={(event) => void submit(event)}
      >
        <FormField label="Source type">
          <select name="sourceType" defaultValue="ISSUER_TERMS">
            <option value="ISSUER_TERMS">Issuer terms</option>
            <option value="CURATOR_RESEARCH">Curator research</option>
            <option value="USER_REPORT">User report</option>
            <option value="OTHER">Other</option>
          </select>
        </FormField>
        <FormField label="Title">
          <input name="title" required />
        </FormField>
        <FormField label="URL">
          <input name="url" type="url" />
        </FormField>
        <FormField label="Retrieved at">
          <input name="retrievedAt" type="datetime-local" />
        </FormField>
        <FormField label="Verified at">
          <input name="verifiedAt" type="datetime-local" />
        </FormField>
        <FormField label="Notes">
          <textarea name="notes" />
        </FormField>
        <button type="submit">Create source</button>
      </form>
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<any>(data)}
            columns={[
              { header: "Title", render: (row) => row.title },
              {
                header: "Type",
                render: (row) => <StatusBadge value={row.sourceType} />,
              },
              {
                header: "URL",
                render: (row) =>
                  row.url ? <a href={row.url}>{row.url}</a> : "n/a",
              },
              {
                header: "Retrieved",
                render: (row) => <DateTime value={row.retrievedAt} />,
              },
              {
                header: "Verified",
                render: (row) => <DateTime value={row.verifiedAt} />,
              },
              { header: "Notes", render: (row) => row.notes ?? "n/a" },
            ]}
          />
        )}
      </AsyncBlock>
    </>
  );
}
