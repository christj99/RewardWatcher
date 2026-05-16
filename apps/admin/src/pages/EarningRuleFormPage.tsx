import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../components/ErrorState";
import { FormField } from "../components/FormField";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import {
  asArray,
  optionalNumber,
  optionalString,
  toIsoOrUndefined,
} from "./pageUtils";

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

export function EarningRuleFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const api = useAdminApi();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const state = useAsync(async () => {
    const [cards, currencies, merchants, sources, rule] = await Promise.all([
      api.listCards(),
      api.listCurrencies(),
      api.listMerchants(),
      api.listRuleSources(),
      isEdit ? api.getEarningRule(id ?? "") : Promise.resolve(null),
    ]);
    return {
      cards: asArray<any>(cards),
      currencies: asArray<any>(currencies),
      merchants: asArray<any>(merchants),
      sources: asArray<any>(sources),
      rule: rule as any,
    };
  }, [api, id, isEdit]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const multiplier = Number(form.get("multiplier"));
    const capAmount = optionalNumber(form.get("capAmountCents"));
    const capPeriod = optionalString(form.get("capPeriod"));
    if (!form.get("cardId") || !form.get("rewardCurrencyId")) {
      setFormError("Card and reward currency are required.");
      return;
    }
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      setFormError("Multiplier must be positive.");
      return;
    }
    if (
      (capAmount !== null && capAmount !== undefined && !capPeriod) ||
      (capPeriod && (capAmount === null || capAmount === undefined))
    ) {
      setFormError("Cap amount and cap period must be provided together.");
      return;
    }
    if (
      !form.get("category") &&
      !form.get("merchantId") &&
      form.get("isBaseRule") !== "on"
    ) {
      setFormError("Choose a category, merchant, or mark this as a base rule.");
      return;
    }

    const body = {
      cardId: String(form.get("cardId")),
      cardVersionId: optionalString(form.get("cardVersionId")),
      rewardCurrencyId: String(form.get("rewardCurrencyId")),
      category: optionalString(form.get("category")),
      merchantId: optionalString(form.get("merchantId")),
      multiplier: String(form.get("multiplier")),
      baseRateMultiplier: optionalString(form.get("baseRateMultiplier")),
      capAmountCents: capAmount,
      capPeriod,
      activationRequired: form.get("activationRequired") === "on",
      startsAt: toIsoOrUndefined(form.get("startsAt")) ?? null,
      endsAt: toIsoOrUndefined(form.get("endsAt")) ?? null,
      confidence: String(form.get("confidence")),
      sourceId: optionalString(form.get("sourceId")),
      notes: optionalString(form.get("notes")),
      isBaseRule: form.get("isBaseRule") === "on",
    };
    const saved = isEdit
      ? await api.updateEarningRule(id ?? "", body)
      : await api.createEarningRule(body);
    navigate(`/earning-rules/${(saved as any).id ?? id}/edit`);
  }

  if (state.isLoading) return <LoadingState />;
  if (state.error)
    return <ErrorState error={state.error} onRetry={state.reload} />;
  const rule = state.data?.rule;

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit Earning Rule" : "Create Earning Rule"}
        description="Rules stay deterministic: source, confidence, scope, caps, and dates are explicit."
      />
      {formError ? <ErrorState error={formError} /> : null}
      <form
        className="panel form-grid"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <FormField label="Card">
          <select
            name="cardId"
            defaultValue={
              rule?.cardId ?? rule?.card?.id ?? searchParams.get("cardId") ?? ""
            }
            required
          >
            <option value="">Select card</option>
            {state.data?.cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Card version id">
          <input
            name="cardVersionId"
            defaultValue={rule?.cardVersionId ?? ""}
          />
        </FormField>
        <FormField label="Reward currency">
          <select
            name="rewardCurrencyId"
            defaultValue={
              rule?.rewardCurrencyId ?? rule?.rewardCurrency?.id ?? ""
            }
            required
          >
            <option value="">Select currency</option>
            {state.data?.currencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.code} - {currency.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Category">
          <select name="category" defaultValue={rule?.category ?? ""}>
            <option value="">None</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Merchant">
          <select
            name="merchantId"
            defaultValue={rule?.merchantId ?? rule?.merchant?.id ?? ""}
          >
            <option value="">None</option>
            {state.data?.merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Base rule">
          <input
            name="isBaseRule"
            type="checkbox"
            defaultChecked={!rule?.category && !rule?.merchantId}
          />
        </FormField>
        <FormField label="Multiplier">
          <input
            name="multiplier"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={rule?.multiplier ?? ""}
            required
          />
        </FormField>
        <FormField label="Base rate multiplier">
          <input
            name="baseRateMultiplier"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={rule?.baseRateMultiplier ?? ""}
          />
        </FormField>
        <FormField label="Cap amount cents">
          <input
            name="capAmountCents"
            type="number"
            min="0"
            defaultValue={rule?.capAmountCents ?? ""}
          />
        </FormField>
        <FormField label="Cap period">
          <select name="capPeriod" defaultValue={rule?.capPeriod ?? ""}>
            <option value="">None</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUAL">Annual</option>
          </select>
        </FormField>
        <FormField label="Activation required">
          <input
            name="activationRequired"
            type="checkbox"
            defaultChecked={rule?.activationRequired ?? false}
          />
        </FormField>
        <FormField label="Starts at">
          <input name="startsAt" type="datetime-local" />
        </FormField>
        <FormField label="Ends at">
          <input name="endsAt" type="datetime-local" />
        </FormField>
        <FormField label="Confidence">
          <select
            name="confidence"
            defaultValue={rule?.confidence ?? "MEDIUM"}
            required
          >
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </FormField>
        <FormField label="Source">
          <select
            name="sourceId"
            defaultValue={rule?.sourceId ?? rule?.source?.id ?? ""}
          >
            <option value="">No source</option>
            {state.data?.sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.title}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Notes">
          <textarea name="notes" defaultValue={rule?.notes ?? ""} />
        </FormField>
        <button type="submit">{isEdit ? "Save rule" : "Create rule"}</button>
      </form>
    </>
  );
}
