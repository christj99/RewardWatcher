import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { errorMessage } from "../api/errors.js";
import type { CorrectionType, MerchantCategory } from "../api/types.js";
import { ConfidenceBadge } from "../components/ConfidenceBadge.js";
import { CorrectionStatusBadge } from "../components/CorrectionStatusBadge.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { MerchantSummary } from "../components/MerchantSummary.js";
import { MoneyValue } from "../components/MoneyValue.js";
import { OutcomeBadge } from "../components/OutcomeBadge.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

const correctionTypes: CorrectionType[] = [
  "WRONG_MERCHANT",
  "WRONG_CATEGORY",
  "WRONG_CARD_RULE",
  "MISSED_OFFER",
  "CAP_NOT_HANDLED",
  "PERSONAL_PREFERENCE",
  "OTHER",
];

const categories: MerchantCategory[] = [
  "DINING",
  "GROCERY",
  "TRAVEL",
  "AIRFARE",
  "HOTEL",
  "RIDESHARE",
  "GAS",
  "DRUGSTORE",
  "STREAMING",
  "ONLINE_RETAIL",
  "WHOLESALE_CLUB",
  "GENERAL",
  "OTHER",
  "UNKNOWN",
];

export function RecommendationReceiptPage() {
  const { id } = useParams();
  const state = useAsync(() => apiClient.getRecommendation(id ?? ""), [id]);
  const [message, setMessage] = useState<string | null>(null);

  if (!id) return <ErrorState message="Missing recommendation id." />;
  if (state.isLoading) return <LoadingState label="Loading receipt" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        message={state.error ?? "Could not load receipt."}
        onRetry={state.reload}
      />
    );
  }

  const receipt = state.data;
  const recommendationId = id;

  async function submitCorrection(body: CorrectionBody) {
    setMessage(null);
    await apiClient.submitRecommendationCorrection(recommendationId, body);
    setMessage(
      "Thanks, correction submitted. Shared data changes require curator review.",
    );
    state.reload();
  }

  return (
    <section>
      <PageHeader
        title="Recommendation Receipt"
        description="The stored recommendation, inputs, and reasoning."
      />
      <section className="panel">
        <div className="split">
          <h2>
            {receipt.primaryRecommendation?.cardName ??
              receipt.recommendedCard?.name ??
              "Recommendation"}
          </h2>
          <ConfidenceBadge level={receipt.confidence} />
        </div>
        <p>{receipt.explanation}</p>
        <dl className="detail-list">
          <div>
            <dt>Merchant</dt>
            <dd>
              <MerchantSummary merchant={receipt.merchant} />
            </dd>
          </div>
          <div>
            <dt>Expected category</dt>
            <dd>{receipt.expectedCategory.replace("_", " ")}</dd>
          </div>
          <div>
            <dt>Expected value</dt>
            <dd>
              <MoneyValue
                cents={
                  receipt.primaryRecommendation?.expectedValueCents ??
                  receipt.expectedValueCents
                }
              />
            </dd>
          </div>
          <div>
            <dt>Lens</dt>
            <dd>{receipt.lens.replace("_", " ")}</dd>
          </div>
        </dl>
        {receipt.warnings?.length ? (
          <ul className="warning-list">
            {receipt.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <Link
          to={`/feedback?recommendationId=${encodeURIComponent(
            recommendationId,
          )}&type=WRONG_RECOMMENDATION`}
        >
          Report issue with this recommendation
        </Link>
      </section>

      <section className="panel">
        <h2>Alternatives</h2>
        {receipt.alternatives?.length ? (
          <div className="card-list">
            {receipt.alternatives.map((card) => (
              <article
                className="list-card"
                key={`${card.userCardId}-${card.rank}`}
              >
                <strong>
                  {card.rank}. {card.cardName}
                </strong>
                <span>{card.issuerName}</span>
                <span>
                  <MoneyValue cents={card.expectedValueCents} />
                </span>
                <ConfidenceBadge level={card.confidence} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No alternatives saved"
            description="The primary recommendation is still auditable."
          />
        )}
      </section>

      <section className="panel">
        <h2>Corrections</h2>
        {receipt.corrections?.length ? (
          <div className="card-list">
            {receipt.corrections.map((correction) => (
              <article className="list-card" key={correction.id}>
                <CorrectionStatusBadge status={correction.status} />
                <strong>{correction.correctionType.replace("_", " ")}</strong>
                {correction.userNote ? <p>{correction.userNote}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No corrections submitted for this receipt.</p>
        )}
        <CorrectionForm onSubmit={submitCorrection} />
        {message ? <p className="success-message">{message}</p> : null}
      </section>

      <section className="panel">
        <h2>Outcomes</h2>
        {receipt.outcomes?.length ? (
          <div className="card-list">
            {receipt.outcomes.map((outcome) => (
              <article className="list-card" key={outcome.id}>
                <OutcomeBadge type={outcome.outcomeType} />
                <p>{outcome.explanation}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No posted transaction matched yet"
            description="Import a transaction later to close the audit loop."
            actionHref="/transactions/import"
            actionLabel="Import transaction"
          />
        )}
      </section>

      <details className="panel">
        <summary>Technical snapshots</summary>
        <Snapshot title="Input snapshot" value={receipt.inputSnapshot} />
        <Snapshot title="Ranking snapshot" value={receipt.rankingSnapshot} />
        <Snapshot title="Rule snapshot" value={receipt.ruleSnapshot} />
      </details>
      <Link to="/recommendations">Back to history</Link>
    </section>
  );
}

type CorrectionBody = {
  correctionType: CorrectionType;
  userNote?: string;
  suggestedCategory?: MerchantCategory;
  preferenceAction?: "PREFER_CARD" | "AVOID_CARD" | "CUSTOM_NOTE";
};

function CorrectionForm({
  onSubmit,
}: {
  onSubmit: (body: CorrectionBody) => Promise<void>;
}) {
  const [correctionType, setCorrectionType] =
    useState<CorrectionType>("WRONG_CATEGORY");
  const [userNote, setUserNote] = useState("");
  const [suggestedCategory, setSuggestedCategory] = useState("");
  const [preferenceAction, setPreferenceAction] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const body: CorrectionBody = { correctionType };
      if (userNote.trim()) body.userNote = userNote.trim();
      if (suggestedCategory)
        body.suggestedCategory = suggestedCategory as MerchantCategory;
      if (correctionType === "PERSONAL_PREFERENCE" && preferenceAction) {
        body.preferenceAction = preferenceAction as NonNullable<
          CorrectionBody["preferenceAction"]
        >;
      }
      await onSubmit(body);
      setUserNote("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Correction type
        <select
          value={correctionType}
          onChange={(event) =>
            setCorrectionType(event.target.value as CorrectionType)
          }
        >
          {correctionTypes.map((type) => (
            <option value={type} key={type}>
              {type.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Note
        <textarea
          value={userNote}
          onChange={(event) => setUserNote(event.target.value)}
        />
      </label>
      <label>
        Suggested category
        <select
          value={suggestedCategory}
          onChange={(event) => setSuggestedCategory(event.target.value)}
        >
          <option value="">No suggestion</option>
          {categories.map((category) => (
            <option value={category} key={category}>
              {category.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      {correctionType === "PERSONAL_PREFERENCE" ? (
        <label>
          Preference action
          <select
            value={preferenceAction}
            onChange={(event) => setPreferenceAction(event.target.value)}
          >
            <option value="">No preference rule</option>
            <option value="PREFER_CARD">Prefer card</option>
            <option value="AVOID_CARD">Avoid card</option>
            <option value="CUSTOM_NOTE">Custom note</option>
          </select>
        </label>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit">Submit correction</button>
    </form>
  );
}

function Snapshot({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="snapshot">
      <h3>{title}</h3>
      <pre>{JSON.stringify(value ?? {}, null, 2)}</pre>
    </div>
  );
}
