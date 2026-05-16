import { useState } from "react";

import { apiClient } from "../api/client.js";
import type { UserOffer, UserOfferStatus } from "../api/types.js";
import { ConfidenceBadge } from "../components/ConfidenceBadge.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { MoneyValue } from "../components/MoneyValue.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

export function OffersPage() {
  const [status, setStatus] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const state = useAsync(() => apiClient.getOffers({ status }), [status]);

  async function updateOffer(offer: UserOffer, nextStatus: UserOfferStatus) {
    const userCardId = offer.userActivation.userCardId;
    await apiClient.updateOfferActivation(offer.offer.id, {
      ...(userCardId !== undefined ? { userCardId } : {}),
      status: nextStatus,
    });
    setMessage(`Marked ${offer.offer.title} ${label(nextStatus)}.`);
    state.reload();
  }

  if (state.isLoading) return <LoadingState label="Loading offers" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        message={state.error ?? "Offers unavailable."}
        onRetry={state.reload}
      />
    );
  }

  return (
    <section>
      <PageHeader
        title="Offers"
        description="Track manually curated issuer and card offers. Activated offers can affect deterministic recommendations; available offers are shown as actions, not guaranteed value."
      />
      <label className="field">
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All active</option>
          <option value="AVAILABLE">Available</option>
          <option value="ACTIVATED">Activated</option>
          <option value="USED">Used</option>
          <option value="DISMISSED">Dismissed</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </label>
      {message ? <p className="callout">{message}</p> : null}
      {state.data.length === 0 ? (
        <EmptyState
          title="No relevant offers yet"
          description="Offers are curated manually in this beta. Check back after new card and merchant data is added."
        />
      ) : (
        <div className="stack">
          {state.data.map((offer) => (
            <OfferCard
              key={offer.offer.id}
              offer={offer}
              onUpdate={updateOffer}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OfferCard({
  offer,
  onUpdate,
}: {
  offer: UserOffer;
  onUpdate: (offer: UserOffer, status: UserOfferStatus) => Promise<void>;
}) {
  return (
    <article className="list-card">
      <div className="split">
        <div>
          <strong>{offer.offer.title}</strong>
          <p>{offer.offer.description}</p>
        </div>
        <ConfidenceBadge level={offer.offer.confidence} />
      </div>
      <dl className="detail-list">
        <div>
          <dt>Status</dt>
          <dd>{label(offer.userActivation.status)}</dd>
        </div>
        <div>
          <dt>Card</dt>
          <dd>
            {offer.offer.card?.name ??
              offer.relevance.matchingUserCards[0]?.cardName ??
              "Eligible wallet card"}
          </dd>
        </div>
        <div>
          <dt>Merchant/category</dt>
          <dd>
            {offer.offer.merchant?.name ??
              offer.offer.category ??
              "Broad offer"}
          </dd>
        </div>
        <div>
          <dt>Value</dt>
          <dd>{formatOfferValue(offer)}</dd>
        </div>
        <div>
          <dt>Minimum spend</dt>
          <dd>
            <MoneyValue cents={offer.offer.minSpendCents} />
          </dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>
            {offer.offer.endsAt
              ? new Date(offer.offer.endsAt).toLocaleDateString()
              : "No listed end date"}
          </dd>
        </div>
      </dl>
      <p className="muted">
        Ranked by deterministic expected value when activated; Rewards Audit
        does not activate offers or collect issuer credentials.
      </p>
      <div className="action-list">
        <button
          className="button"
          type="button"
          onClick={() => {
            void onUpdate(offer, "ACTIVATED");
          }}
        >
          Mark activated
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            void onUpdate(offer, "USED");
          }}
        >
          Mark used
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            void onUpdate(offer, "DISMISSED");
          }}
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}

function formatOfferValue(offer: UserOffer): string {
  if (offer.offer.valueCents !== null && offer.offer.valueCents !== undefined) {
    return `$${(offer.offer.valueCents / 100).toFixed(2)}`;
  }
  if (offer.offer.bonusPoints) {
    return `${offer.offer.bonusPoints.toLocaleString()} ${offer.offer.bonusCurrency?.code ?? "points"}`;
  }
  if (offer.offer.bonusMultiplier) {
    return `+${offer.offer.bonusMultiplier}x ${offer.offer.bonusCurrency?.code ?? "points"}`;
  }
  return "See terms";
}

function label(value: string): string {
  return value.toLowerCase().replaceAll("_", " ");
}
