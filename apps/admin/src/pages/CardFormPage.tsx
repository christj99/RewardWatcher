import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ErrorState } from "../components/ErrorState";
import { FormField } from "../components/FormField";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { useAdminApi } from "../hooks/useAdminApi";
import { useAsync } from "../hooks/useAsync";
import { asArray, optionalNumber, optionalString } from "./pageUtils";

export function CardFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const api = useAdminApi();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const state = useAsync(async () => {
    const [issuers, card] = await Promise.all([
      api.listIssuers(),
      isEdit ? api.getCard(id ?? "") : Promise.resolve(null),
    ]);
    return { issuers: asArray<any>(issuers), card: card as any };
  }, [api, id, isEdit]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    if (!form.get("issuerId") || !form.get("name")) {
      setFormError("Issuer and name are required.");
      return;
    }
    const body = {
      issuerId: String(form.get("issuerId")),
      name: String(form.get("name")),
      slug: optionalString(form.get("slug")) ?? undefined,
      network: optionalString(form.get("network")),
      annualFeeCents: optionalNumber(form.get("annualFeeCents")),
      isActive: form.get("isActive") === "on",
    };
    const saved = isEdit
      ? await api.updateCard(id ?? "", body)
      : await api.createCard(body);
    navigate(`/cards/${(saved as any).id ?? id}`);
  }

  if (state.isLoading) return <LoadingState />;
  if (state.error)
    return <ErrorState error={state.error} onRetry={state.reload} />;

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit Card" : "Create Card"}
        description="Card metadata changes do not rewrite historical card versions."
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
            defaultValue={
              state.data?.card?.issuerId ?? state.data?.card?.issuer?.id ?? ""
            }
            required
          >
            <option value="">Select issuer</option>
            {state.data?.issuers.map((issuer) => (
              <option key={issuer.id} value={issuer.id}>
                {issuer.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Name">
          <input
            name="name"
            defaultValue={state.data?.card?.name ?? ""}
            required
          />
        </FormField>
        <FormField label="Slug">
          <input name="slug" defaultValue={state.data?.card?.slug ?? ""} />
        </FormField>
        <FormField label="Network">
          <select name="network" defaultValue={state.data?.card?.network ?? ""}>
            <option value="">None</option>
            <option value="VISA">Visa</option>
            <option value="MASTERCARD">Mastercard</option>
            <option value="AMEX">Amex</option>
            <option value="DISCOVER">Discover</option>
          </select>
        </FormField>
        <FormField label="Annual fee cents">
          <input
            name="annualFeeCents"
            type="number"
            min="0"
            defaultValue={state.data?.card?.annualFeeCents ?? ""}
          />
        </FormField>
        <FormField label="Active">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={state.data?.card?.isActive ?? true}
          />
        </FormField>
        <button type="submit">{isEdit ? "Save card" : "Create card"}</button>
      </form>
    </>
  );
}
