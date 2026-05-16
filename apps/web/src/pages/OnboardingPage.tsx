import { Link } from "react-router-dom";

import { apiClient } from "../api/client.js";
import type { CardSummary as CardSummaryType } from "../api/types.js";
import { CardSummary } from "../components/CardSummary.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";
import { CardSearchForm } from "./WalletPage.js";

export function OnboardingPage() {
  const state = useAsync(() => apiClient.getWallet(), []);

  if (state.isLoading) return <LoadingState label="Loading onboarding" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        message={state.error ?? "Could not load wallet."}
        onRetry={state.reload}
      />
    );
  }

  async function addCard(card: CardSummaryType) {
    await apiClient.addWalletCard({ cardId: card.id });
    state.reload();
  }

  return (
    <section>
      <PageHeader
        title="Set Up Your Wallet"
        description="Rewards Audit recommends a card, records why, and later checks what actually happened."
      />
      <div className="panel-grid">
        <section className="panel">
          <h2>Add a Card</h2>
          <CardSearchForm onAdd={addCard} />
        </section>
        <section className="panel">
          <h2>Selected Cards</h2>
          {state.data.length === 0 ? (
            <EmptyState
              title="No wallet cards yet"
              description="Search for a card to start getting recommendations."
            />
          ) : (
            <div className="card-list">
              {state.data.map((userCard) => (
                <article className="list-card" key={userCard.id}>
                  <CardSummary card={userCard.card} userCard={userCard} />
                </article>
              ))}
            </div>
          )}
          <Link
            className="button"
            aria-disabled={state.data.length === 0}
            to="/"
          >
            Continue to dashboard
          </Link>
        </section>
      </div>
    </section>
  );
}
