import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

export function OfferFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const api = useAdminApi();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const state = useAsync(async () => {
    const [issuers, cards, merchants, currencies, sources, offer] =
      await Promise.all([
        api.listIssuers(),
        api.listCards(),
        api.listMerchants(),
        api.listCurrencies(),
        api.listRuleSources(),
        isEdit ? api.getOffer(id ?? "") : Promise.resolve(null),
      ]);
    return {
      issuers: asArray<any>(issuers),
      cards: asArray<any>(cards),
      merchants: asArray<any>(merchants),
      currencies: asArray<any>(currencies),
      sources: asArray<any>(sources),
      offer: offer as any,
    };
  }, [api, id, isEdit]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const offerType = String(form.get("offerType"));
    const hasTarget = Boolean(
      form.get("issuerId") ||
        form.get("cardId") ||
        form.get("merchantId") ||
        form.get("category"),
    );
    if (!hasTarget) {
      setFormError("At least one targeting field is required.");
      return;
    }
    if (
      (offerType === "STATEMENT_CREDIT" || offerType === "DISCOUNT") &&
      !form.get("valueCents") &&
      !form.get("notes")
    ) {
      setFormError(
        "Statement credit and discount offers require value cents or explanatory notes.",
      );
      return;
    }
    if (
      offerType === "BONUS_POINTS" &&
      (!form.get("bonusPoints") || !form.get("bonusCurrencyId"))
    ) {
      setFormError("Bonus points offers require points and currency.");
      return;
    }
    if (
      offerType === "BONUS_MULTIPLIER" &&
      (!form.get("bonusMultiplier") || !form.get("bonusCurrencyId"))
    ) {
      setFormError("Bonus multiplier offers require multiplier and currency.");
      return;
    }
    const body = {
      issuerId: optionalString(form.get("issuerId")),
      cardId: optionalString(form.get("cardId")),
      merchantId: optionalString(form.get("merchantId")),
      category: optionalString(form.get("category")),
      title: form.get("title"),
      description: form.get("description"),
      offerType,
      valueCents: optionalNumber(form.get("valueCents")),
      bonusPoints: optionalNumber(form.get("bonusPoints")),
      bonusCurrencyId: optionalString(form.get("bonusCurrencyId")),
      bonusMultiplier: optionalString(form.get("bonusMultiplier")),
      minSpendCents: optionalNumber(form.get("minSpendCents")),
      maxRewardCents: optionalNumber(form.get("maxRewardCents")),
      activationRequired: form.get("activationRequired") === "on",
      startsAt: toIsoOrUndefined(form.get("startsAt")) ?? null,
      endsAt: toIsoOrUndefined(form.get("endsAt")) ?? null,
      confidence: form.get("confidence"),
      sourceId: optionalString(form.get("sourceId")),
      termsUrl: optionalString(form.get("termsUrl")),
      notes: optionalString(form.get("notes")),
    };
    const saved = isEdit
      ? await api.updateOffer(id ?? "", body)
      : await api.createOffer(body);
    navigate(`/offers/${(saved as any).id ?? id}/edit`);
  }

  if (state.isLoading) return <LoadingState />;
  if (state.error)
    return <ErrorState error={state.error} onRetry={state.reload} />;
  const offer = state.data?.offer;

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit Offer" : "Create Offer"}
        description="Available offers can warn users; activated offers can affect deterministic ranking."
      />
      {formError ? <ErrorState error={formError} /> : null}
      <form
        className="panel form-grid"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <FormField label="Issuer">
          <select
            name="issuerId"
            defaultValue={offer?.issuerId ?? offer?.issuer?.id ?? ""}
          >
            <option value="">Any issuer</option>
            {state.data?.issuers.map((issuer) => (
              <option key={issuer.id} value={issuer.id}>
                {issuer.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Card">
          <select
            name="cardId"
            defaultValue={offer?.cardId ?? offer?.card?.id ?? ""}
          >
            <option value="">Any card</option>
            {state.data?.cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Merchant">
          <select
            name="merchantId"
            defaultValue={offer?.merchantId ?? offer?.merchant?.id ?? ""}
          >
            <option value="">Any merchant</option>
            {state.data?.merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Category">
          <select name="category" defaultValue={offer?.category ?? ""}>
            <option value="">Any category</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Title">
          <input name="title" defaultValue={offer?.title ?? ""} required />
        </FormField>
        <FormField label="Description">
          <textarea
            name="description"
            defaultValue={offer?.description ?? ""}
            required
          />
        </FormField>
        <FormField label="Offer type">
          <select
            name="offerType"
            defaultValue={offer?.offerType ?? "STATEMENT_CREDIT"}
          >
            <option>STATEMENT_CREDIT</option>
            <option>BONUS_POINTS</option>
            <option>BONUS_MULTIPLIER</option>
            <option>DISCOUNT</option>
            <option>OTHER</option>
          </select>
        </FormField>
        <FormField label="Value cents">
          <input
            name="valueCents"
            type="number"
            min="0"
            defaultValue={offer?.valueCents ?? ""}
          />
        </FormField>
        <FormField label="Bonus points">
          <input
            name="bonusPoints"
            type="number"
            min="0"
            defaultValue={offer?.bonusPoints ?? ""}
          />
        </FormField>
        <FormField label="Bonus currency">
          <select
            name="bonusCurrencyId"
            defaultValue={
              offer?.bonusCurrencyId ?? offer?.bonusCurrency?.id ?? ""
            }
          >
            <option value="">None</option>
            {state.data?.currencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.code}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Bonus multiplier">
          <input
            name="bonusMultiplier"
            type="number"
            min="0"
            step="0.01"
            defaultValue={offer?.bonusMultiplier ?? ""}
          />
        </FormField>
        <FormField label="Min spend cents">
          <input
            name="minSpendCents"
            type="number"
            min="0"
            defaultValue={offer?.minSpendCents ?? ""}
          />
        </FormField>
        <FormField label="Max reward cents">
          <input
            name="maxRewardCents"
            type="number"
            min="0"
            defaultValue={offer?.maxRewardCents ?? ""}
          />
        </FormField>
        <FormField label="Activation required">
          <input
            name="activationRequired"
            type="checkbox"
            defaultChecked={offer?.activationRequired ?? true}
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
            defaultValue={offer?.confidence ?? "MEDIUM"}
          >
            <option>HIGH</option>
            <option>MEDIUM</option>
            <option>LOW</option>
            <option>UNKNOWN</option>
          </select>
        </FormField>
        <FormField label="Source">
          <select
            name="sourceId"
            defaultValue={offer?.sourceId ?? offer?.source?.id ?? ""}
          >
            <option value="">No source</option>
            {state.data?.sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.title}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Terms URL">
          <input
            name="termsUrl"
            type="url"
            defaultValue={offer?.termsUrl ?? ""}
          />
        </FormField>
        <FormField label="Notes">
          <textarea name="notes" defaultValue={offer?.notes ?? ""} />
        </FormField>
        <button type="submit">{isEdit ? "Save offer" : "Create offer"}</button>
      </form>
    </>
  );
}
