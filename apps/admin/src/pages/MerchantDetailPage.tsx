import { useState } from "react";
import { useParams } from "react-router-dom";

import { ConfirmButton } from "../components/ConfirmButton";
import { DataTable } from "../components/DataTable";
import { DateTime } from "../components/DateTime";
import { ErrorState } from "../components/ErrorState";
import { FormField } from "../components/FormField";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, toIsoOrUndefined } from "./pageUtils";

const categories = [
  "GENERAL",
  "GROCERY",
  "DINING",
  "TRAVEL",
  "HOTEL",
  "AIRFARE",
  "RIDESHARE",
  "GAS",
  "DRUGSTORE",
  "ONLINE_RETAIL",
  "WHOLESALE_CLUB",
  "ENTERTAINMENT",
  "UNKNOWN",
];

export function MerchantDetailPage() {
  const { id } = useParams();
  const api = useAdminApi();
  const state = useAsync(async () => {
    if (id === "new") return { merchant: null, profiles: [] };
    const [merchant, profiles] = await Promise.all([
      api.getMerchant(id ?? ""),
      api.listMerchantPostingProfiles({ merchantId: id }),
    ]);
    return { merchant: merchant as any, profiles: asArray<any>(profiles) };
  }, [api, id]);
  const [error, setError] = useState<string | null>(null);

  async function saveMerchant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      slug: String(form.get("slug") ?? "").trim() || undefined,
      category: form.get("category"),
      websiteUrl: String(form.get("websiteUrl") ?? "").trim() || null,
    };
    if (id === "new") {
      const saved = await api.createMerchant(body);
      window.history.replaceState(null, "", `/merchants/${(saved as any).id}`);
    } else {
      await api.updateMerchant(id ?? "", body);
    }
    await state.reload();
  }

  async function addPattern(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const pattern = String(form.get("pattern") ?? "");
    const patternType = String(form.get("patternType") ?? "");
    if (patternType === "DOMAIN" && /^https?:\/\//i.test(pattern)) {
      setError("DOMAIN patterns must not include a protocol.");
      return;
    }
    await api.createMerchantUrlPattern(id ?? "", {
      pattern,
      patternType,
      confidence: form.get("confidence"),
    });
    event.currentTarget.reset();
    await state.reload();
  }

  async function addProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.createMerchantPostingProfile({
      merchantId: id,
      observedCategory: form.get("observedCategory"),
      observedMcc: String(form.get("observedMcc") ?? "").trim() || null,
      dataSource: form.get("dataSource"),
      confidence: form.get("confidence"),
      observationCount: Number(form.get("observationCount") || 0),
      lastObservedAt: toIsoOrUndefined(form.get("lastObservedAt")) ?? null,
      notes: String(form.get("notes") ?? "").trim() || null,
    });
    event.currentTarget.reset();
    await state.reload();
  }

  if (state.isLoading) return <LoadingState />;
  if (state.error)
    return <ErrorState error={state.error} onRetry={state.reload} />;
  const merchant = state.data?.merchant;

  return (
    <>
      <PageHeader
        title={merchant?.name ?? "Create Merchant"}
        description="Curate merchant category, URL resolution patterns, and issuer/network posting behavior."
      />
      {error ? <ErrorState error={error} /> : null}
      <form
        className="panel form-grid"
        onSubmit={(event) => void saveMerchant(event)}
      >
        <FormField label="Name">
          <input name="name" defaultValue={merchant?.name ?? ""} required />
        </FormField>
        <FormField label="Slug">
          <input name="slug" defaultValue={merchant?.slug ?? ""} />
        </FormField>
        <FormField label="Category">
          <select
            name="category"
            defaultValue={merchant?.category ?? "GENERAL"}
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Website URL">
          <input
            name="websiteUrl"
            type="url"
            defaultValue={merchant?.websiteUrl ?? ""}
          />
        </FormField>
        <button type="submit">
          {merchant ? "Save merchant" : "Create merchant"}
        </button>
      </form>
      {merchant ? (
        <>
          <section className="panel">
            <h2>URL patterns</h2>
            <form
              className="form-grid"
              onSubmit={(event) => void addPattern(event)}
            >
              <FormField label="Pattern">
                <input name="pattern" required />
              </FormField>
              <FormField label="Type">
                <select name="patternType" defaultValue="DOMAIN">
                  <option>DOMAIN</option>
                  <option>URL_CONTAINS</option>
                  <option>REGEX</option>
                </select>
              </FormField>
              <FormField label="Confidence">
                <select name="confidence" defaultValue="MEDIUM">
                  <option>HIGH</option>
                  <option>MEDIUM</option>
                  <option>LOW</option>
                  <option>UNKNOWN</option>
                </select>
              </FormField>
              <button type="submit">Add pattern</button>
            </form>
            <DataTable
              rows={asArray<any>(merchant.urlPatterns)}
              columns={[
                { header: "Pattern", render: (row) => row.pattern },
                {
                  header: "Type",
                  render: (row) => <StatusBadge value={row.patternType} />,
                },
                {
                  header: "Confidence",
                  render: (row) => <StatusBadge value={row.confidence} />,
                },
                {
                  header: "Actions",
                  render: (row) => (
                    <ConfirmButton
                      confirmLabel="Delete"
                      onConfirm={async () => {
                        await api.deleteMerchantUrlPattern(row.id);
                        await state.reload();
                      }}
                    >
                      Delete
                    </ConfirmButton>
                  ),
                },
              ]}
            />
          </section>
          <section className="panel">
            <h2>Posting profiles</h2>
            <form
              className="form-grid"
              onSubmit={(event) => void addProfile(event)}
            >
              <FormField label="Observed category">
                <select name="observedCategory" defaultValue="GENERAL">
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Observed MCC">
                <input name="observedMcc" />
              </FormField>
              <FormField label="Data source">
                <select name="dataSource" defaultValue="CURATOR">
                  <option>CURATOR</option>
                  <option>TRANSACTION_OUTCOME</option>
                  <option>USER_REPORT</option>
                  <option>OTHER</option>
                </select>
              </FormField>
              <FormField label="Confidence">
                <select name="confidence" defaultValue="MEDIUM">
                  <option>HIGH</option>
                  <option>MEDIUM</option>
                  <option>LOW</option>
                  <option>UNKNOWN</option>
                </select>
              </FormField>
              <FormField label="Observation count">
                <input
                  name="observationCount"
                  type="number"
                  min="0"
                  defaultValue="0"
                />
              </FormField>
              <FormField label="Last observed">
                <input name="lastObservedAt" type="datetime-local" />
              </FormField>
              <FormField label="Notes">
                <textarea name="notes" />
              </FormField>
              <button type="submit">Add profile</button>
            </form>
            <DataTable
              rows={state.data?.profiles ?? []}
              columns={[
                {
                  header: "Category",
                  render: (row) => <StatusBadge value={row.observedCategory} />,
                },
                { header: "Network", render: (row) => row.network ?? "Any" },
                {
                  header: "Confidence",
                  render: (row) => <StatusBadge value={row.confidence} />,
                },
                {
                  header: "Last observed",
                  render: (row) => <DateTime value={row.lastObservedAt} />,
                },
              ]}
            />
          </section>
        </>
      ) : null}
    </>
  );
}
