import type { CardSummary as CardSummaryType, UserCard } from "../api/types.js";
import { MoneyValue } from "./MoneyValue.js";

export function CardSummary({
  card,
  userCard,
}: {
  card: CardSummaryType;
  userCard?: UserCard;
}) {
  return (
    <div className="summary">
      <strong>{userCard?.nickname || card.name}</strong>
      <span>{card.issuer?.name ?? "Unknown issuer"}</span>
      {userCard?.nickname ? <span>{card.name}</span> : null}
      {card.annualFeeCents !== null && card.annualFeeCents !== undefined ? (
        <span>
          Annual fee: <MoneyValue cents={card.annualFeeCents} />
        </span>
      ) : null}
    </div>
  );
}
