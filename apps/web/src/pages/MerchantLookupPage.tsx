import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { errorMessage } from "../api/errors.js";
import type { Lens, Merchant, RecommendationReceipt } from "../api/types.js";
import { ConfidenceBadge } from "../components/ConfidenceBadge.js";
import { EmptyState } from "../components/EmptyState.js";
import { MoneyValue, dollarsToCents } from "../components/MoneyValue.js";
import { PageHeader } from "../components/PageHeader.js";

export function MerchantLookupPage() {
  const [q, setQ] = useState("");
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [merchantUrl, setMerchantUrl] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [lens, setLens] = useState<Lens>("PRACTICAL");
  const [result, setResult] = useState<RecommendationReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      setMerchants(await apiClient.searchMerchants(q));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function resolveUrl() {
    setError(null);
    try {
      const response = await apiClient.getMerchantByUrl(merchantUrl);
      setSelected(response.merchant);
      setMerchantName(response.merchant.name);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function recommend(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const parsedPurchaseAmountCents = amount
      ? dollarsToCents(amount)
      : undefined;
    if (amount && parsedPurchaseAmountCents === null) {
      setError("Purchase amount must be positive.");
      return;
    }
    const purchaseAmountCents = parsedPurchaseAmountCents ?? undefined;
    if (!selected?.id && !merchantUrl.trim() && !merchantName.trim()) {
      setError(
        "Choose a merchant, enter a merchant URL, or type a merchant name.",
      );
      return;
    }
    try {
      setResult(
        await apiClient.createRecommendation({
          merchantId: selected?.id,
          merchantUrl: merchantUrl.trim() || undefined,
          merchantName: merchantName.trim() || selected?.name,
          purchaseAmountCents,
          lens,
          context: "MANUAL_LOOKUP",
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section>
      <PageHeader
        title="Merchant Lookup"
        description="Ask for a deterministic card recommendation and keep the receipt for later audit."
      />
      <div className="panel-grid">
        <section className="panel">
          <form onSubmit={search} className="form-row">
            <label>
              Search merchants
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Starbucks"
              />
            </label>
            <button type="submit">Search</button>
          </form>
          <div className="card-list">
            {merchants.map((merchant) => (
              <button
                className={`select-card ${selected?.id === merchant.id ? "selected" : ""}`}
                key={merchant.id}
                type="button"
                onClick={() => {
                  setSelected(merchant);
                  setMerchantName(merchant.name);
                }}
              >
                <strong>{merchant.name}</strong>
                <span>{merchant.category.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <form onSubmit={recommend} className="form-grid">
            <label>
              Merchant URL
              <input
                value={merchantUrl}
                onChange={(event) => setMerchantUrl(event.target.value)}
                placeholder="https://www.amazon.com/checkout"
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => void resolveUrl()}
            >
              Resolve URL
            </button>
            <label>
              Merchant name fallback
              <input
                value={merchantName}
                onChange={(event) => setMerchantName(event.target.value)}
                placeholder="Local merchant"
              />
            </label>
            <label>
              Purchase amount
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="50.00"
              />
            </label>
            <label>
              Valuation lens
              <select
                value={lens}
                onChange={(event) => setLens(event.target.value as Lens)}
              >
                <option value="PRACTICAL">Practical</option>
                <option value="CASH_OUT">Cash out</option>
                <option value="ASPIRATIONAL">Aspirational</option>
              </select>
            </label>
            <button type="submit">Get recommendation</button>
          </form>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </div>

      {result ? (
        <section className="panel result-panel">
          <h2>
            {result.primaryRecommendation?.cardName ??
              result.recommendedCard?.name}{" "}
            is recommended
          </h2>
          <ConfidenceBadge level={result.confidence} />
          <p>{result.explanation}</p>
          <dl className="detail-list">
            <div>
              <dt>Expected category</dt>
              <dd>{result.expectedCategory.replace("_", " ")}</dd>
            </div>
            <div>
              <dt>Expected value</dt>
              <dd>
                <MoneyValue
                  cents={
                    result.primaryRecommendation?.expectedValueCents ??
                    result.expectedValueCents
                  }
                />
              </dd>
            </div>
          </dl>
          {result.warnings?.length ? (
            <ul className="warning-list">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <h3>Alternatives</h3>
          {result.alternatives?.length ? (
            <div className="card-list">
              {result.alternatives.map((card) => (
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
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No alternatives returned"
              description="The primary recommendation is still saved as a receipt."
            />
          )}
          <Link className="button" to={`/recommendations/${result.id}`}>
            Open saved receipt
          </Link>
        </section>
      ) : null}
    </section>
  );
}
