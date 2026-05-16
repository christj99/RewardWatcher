import { useState, type FormEvent } from "react";

import { apiClient } from "../api/client.js";
import { ApiError, errorMessage } from "../api/errors.js";
import type { CardSummary as CardSummaryType, UserCard } from "../api/types.js";
import { CardSummary } from "../components/CardSummary.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

export function WalletPage() {
  const state = useAsync(() => apiClient.getWallet(), []);

  if (state.isLoading) return <LoadingState label="Loading wallet" />;
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
        title="Wallet"
        description="Manage the cards the recommendation engine can choose from."
      />
      <div className="panel-grid">
        <section className="panel">
          <h2>Add Card</h2>
          <CardSearchForm onAdd={addCard} />
        </section>
        <section className="panel">
          <h2>Active Cards</h2>
          {state.data.length === 0 ? (
            <EmptyState
              title="No active cards"
              description="Add at least one card to request recommendations."
            />
          ) : (
            <div className="card-list">
              {state.data.map((userCard) => (
                <WalletCardEditor
                  key={userCard.id}
                  userCard={userCard}
                  onChange={state.reload}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export function CardSearchForm({
  onAdd,
}: {
  onAdd: (card: CardSummaryType) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [cards, setCards] = useState<CardSummaryType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      setCards(await apiClient.listCards({ q, limit: 20 }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function add(card: CardSummaryType) {
    setError(null);
    try {
      await onAdd(card);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("This card is already in your wallet.");
      } else {
        setError(errorMessage(err));
      }
    }
  }

  return (
    <div>
      <form className="form-row" onSubmit={search}>
        <label>
          Search cards
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Amex Gold"
          />
        </label>
        <button type="submit">{isLoading ? "Searching..." : "Search"}</button>
      </form>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="card-list">
        {cards.map((card) => (
          <article className="list-card split" key={card.id}>
            <CardSummary card={card} />
            <button type="button" onClick={() => void add(card)}>
              Add
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function WalletCardEditor({
  userCard,
  onChange,
}: {
  userCard: UserCard;
  onChange: () => void;
}) {
  const [nickname, setNickname] = useState(userCard.nickname ?? "");
  const [annualFeeDueMonth, setAnnualFeeDueMonth] = useState(
    userCard.annualFeeDueMonth?.toString() ?? "",
  );
  const [openedAt, setOpenedAt] = useState(dateInput(userCard.openedAt));
  const [welcomeBonusDeadline, setWelcomeBonusDeadline] = useState(
    dateInput(userCard.welcomeBonusDeadline),
  );
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const month = annualFeeDueMonth ? Number(annualFeeDueMonth) : null;
    if (
      month !== null &&
      (!Number.isInteger(month) || month < 1 || month > 12)
    ) {
      setError("Annual fee due month must be between 1 and 12.");
      return;
    }
    try {
      await apiClient.updateWalletCard(userCard.id, {
        nickname: nickname.trim() || null,
        annualFeeDueMonth: month,
        openedAt: openedAt ? new Date(openedAt).toISOString() : null,
        welcomeBonusDeadline: welcomeBonusDeadline
          ? new Date(welcomeBonusDeadline).toISOString()
          : null,
      });
      onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function deactivate() {
    if (!window.confirm(`Deactivate ${userCard.card.name}?`)) {
      return;
    }
    await apiClient.deleteWalletCard(userCard.id);
    onChange();
  }

  return (
    <article className="list-card">
      <CardSummary card={userCard.card} userCard={userCard} />
      <div className="form-grid compact">
        <label>
          Nickname
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        <label>
          Annual fee month
          <input
            value={annualFeeDueMonth}
            onChange={(event) => setAnnualFeeDueMonth(event.target.value)}
            inputMode="numeric"
          />
        </label>
        <label>
          Opened at
          <input
            type="date"
            value={openedAt}
            onChange={(event) => setOpenedAt(event.target.value)}
          />
        </label>
        <label>
          Bonus deadline
          <input
            type="date"
            value={welcomeBonusDeadline}
            onChange={(event) => setWelcomeBonusDeadline(event.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="button-row">
        <button type="button" onClick={() => void save()}>
          Save
        </button>
        <button
          type="button"
          className="secondary danger"
          onClick={() => void deactivate()}
        >
          Deactivate
        </button>
      </div>
    </article>
  );
}

function dateInput(value?: string | null): string {
  return value ? value.slice(0, 10) : "";
}
