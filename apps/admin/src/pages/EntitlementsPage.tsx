import { useState, type FormEvent } from "react";

import { DataTable } from "../components/DataTable";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, AsyncBlock } from "./pageUtils";

const entitlementKeys = [
  "FULL_TRANSACTION_AUDIT",
  "WEEKLY_AUDIT_REPORT",
  "STATEMENT_CREDIT_TRACKING",
  "OFFER_AWARE_RECOMMENDATIONS",
  "ADVANCED_LENSES",
  "PLAID_SYNC",
  "EXTENDED_HISTORY",
];

export function EntitlementsPage() {
  const api = useAdminApi();
  const state = useAsync(() => api.listBillingUsers(), [api]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await api.grantEntitlement({
        userId: String(form.get("userId") ?? ""),
        key: String(form.get("key") ?? ""),
        source: String(form.get("source") ?? "MANUAL_GRANT"),
        notes: String(form.get("notes") ?? "") || null,
      });
      setMessage("Entitlement granted.");
      state.reload();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grant failed.");
    }
  }

  async function deactivate(grantId: string) {
    setMessage(null);
    setError(null);
    try {
      await api.updateEntitlementGrant(grantId, { active: false });
      setMessage("Entitlement grant deactivated.");
      state.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <>
      <PageHeader
        title="Billing and Entitlements"
        description="Subscription posture and manual beta access grants."
      />
      <section className="panel">
        <h2>Grant entitlement</h2>
        <form className="form-grid" onSubmit={grant}>
          <label>
            User ID
            <input name="userId" required />
          </label>
          <label>
            Entitlement
            <select name="key" required>
              {entitlementKeys.map((key) => (
                <option key={key} value={key}>
                  {key.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select name="source">
              <option value="MANUAL_GRANT">Manual grant</option>
              <option value="FOUNDING_BETA">Founding beta</option>
            </select>
          </label>
          <label>
            Notes
            <input name="notes" />
          </label>
          <button type="submit">Grant entitlement</button>
        </form>
        {message ? <p className="success-message">{message}</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
      <AsyncBlock state={state}>
        {(data) => (
          <DataTable
            rows={asArray<any>(data)}
            columns={[
              { header: "Email", render: (row) => row.email },
              {
                header: "Plan",
                render: (row) => <StatusBadge value={row.plan} />,
              },
              {
                header: "Subscription",
                render: (row) => row.subscription?.status ?? "NONE",
              },
              {
                header: "Grants",
                render: (row) => (
                  <div className="stack">
                    {(row.entitlementGrants ?? []).map((grant: any) => (
                      <div key={grant.id} className="inline-cluster">
                        <StatusBadge value={grant.key} />
                        <span>{grant.active ? "active" : "inactive"}</span>
                        {grant.active ? (
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => {
                              void deactivate(grant.id);
                            }}
                          >
                            Deactivate
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        )}
      </AsyncBlock>
    </>
  );
}
