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

export function CurrenciesPage() {
  const api = useAdminApi();
  const state = useAsync(async () => {
    const currencies = asArray<any>(await api.listCurrencies());
    const withValuations = await Promise.all(
      currencies.map(async (currency) => ({
        ...currency,
        valuations: asArray<any>(await api.listCurrencyValuations(currency.id)),
      })),
    );
    return withValuations;
  }, [api]);
  const [error, setError] = useState<string | null>(null);

  async function createCurrency(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.createCurrency({
      code: String(form.get("code") ?? "").toUpperCase(),
      name: form.get("name"),
      currencyType: form.get("currencyType"),
    });
    event.currentTarget.reset();
    await state.reload();
  }

  async function createValuation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const cents = Number(form.get("centsPerPoint"));
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("centsPerPoint must be positive.");
      return;
    }
    await api.createCurrencyValuation(String(form.get("currencyId")), {
      lens: form.get("lens"),
      centsPerPoint: String(form.get("centsPerPoint")),
      confidence: form.get("confidence"),
      effectiveFrom:
        toIsoOrUndefined(form.get("effectiveFrom")) ?? new Date().toISOString(),
      notes: String(form.get("notes") ?? "").trim() || null,
    });
    event.currentTarget.reset();
    await state.reload();
  }

  return (
    <>
      <PageHeader
        title="Currencies"
        description="Reward currencies and lens-specific point valuations."
      />
      {error ? <ErrorState error={error} /> : null}
      <div className="grid">
        <form
          className="panel form-grid"
          onSubmit={(event) => void createCurrency(event)}
        >
          <h2>Create currency</h2>
          <FormField label="Code">
            <input name="code" required />
          </FormField>
          <FormField label="Name">
            <input name="name" required />
          </FormField>
          <FormField label="Type">
            <select name="currencyType" defaultValue="POINTS">
              <option value="POINTS">Points</option>
              <option value="CASH">Cash</option>
              <option value="MILES">Miles</option>
            </select>
          </FormField>
          <button type="submit">Create currency</button>
        </form>
        <form
          className="panel form-grid"
          onSubmit={(event) => void createValuation(event)}
        >
          <h2>Create valuation</h2>
          <AsyncBlock state={state}>
            {(currencies) => (
              <FormField label="Currency">
                <select name="currencyId" required>
                  <option value="">Select currency</option>
                  {currencies.map((currency) => (
                    <option key={currency.id} value={currency.id}>
                      {currency.code}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </AsyncBlock>
          <FormField label="Lens">
            <select name="lens" defaultValue="PRACTICAL">
              <option value="PRACTICAL">Practical</option>
              <option value="CASH_OUT">Cash out</option>
              <option value="ASPIRATIONAL">Aspirational</option>
            </select>
          </FormField>
          <FormField label="Cents per point">
            <input
              name="centsPerPoint"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </FormField>
          <FormField label="Confidence">
            <select name="confidence" defaultValue="MEDIUM">
              <option>HIGH</option>
              <option>MEDIUM</option>
              <option>LOW</option>
              <option>UNKNOWN</option>
            </select>
          </FormField>
          <FormField label="Effective from">
            <input name="effectiveFrom" type="datetime-local" />
          </FormField>
          <FormField label="Notes">
            <textarea name="notes" />
          </FormField>
          <button type="submit">Create valuation</button>
        </form>
      </div>
      <AsyncBlock state={state}>
        {(currencies) => (
          <DataTable
            rows={currencies}
            columns={[
              {
                header: "Currency",
                render: (row) => `${row.code} - ${row.name}`,
              },
              {
                header: "Type",
                render: (row) => <StatusBadge value={row.currencyType} />,
              },
              {
                header: "Valuations",
                render: (row) =>
                  row.valuations.map((valuation: any) => (
                    <p key={valuation.id}>
                      {valuation.lens}: {String(valuation.centsPerPoint)} cpp,{" "}
                      <StatusBadge value={valuation.confidence} /> from{" "}
                      <DateTime value={valuation.effectiveFrom} />
                    </p>
                  )),
              },
            ]}
          />
        )}
      </AsyncBlock>
    </>
  );
}
