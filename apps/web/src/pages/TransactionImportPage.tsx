import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { errorMessage } from "../api/errors.js";
import type {
  MerchantCategory,
  RecommendationOutcome,
  Transaction,
} from "../api/types.js";
import { MoneyValue, dollarsToCents } from "../components/MoneyValue.js";
import { OutcomeBadge } from "../components/OutcomeBadge.js";
import { PageHeader } from "../components/PageHeader.js";
import { useAsync } from "../hooks/useAsync.js";

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

export function TransactionImportPage() {
  const wallet = useAsync(() => apiClient.getWallet(), []);
  const [rawMerchantName, setRawMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [postedDate, setPostedDate] = useState("");
  const [userCardId, setUserCardId] = useState("");
  const [observedCategory, setObservedCategory] = useState("");
  const [observedMcc, setObservedMcc] = useState("");
  const [audit, setAudit] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const amountCents = dollarsToCents(amount);
    if (!rawMerchantName.trim()) {
      setError("Merchant name is required.");
      return;
    }
    if (amountCents === null) {
      setError("Amount must be positive.");
      return;
    }
    if (!transactionDate) {
      setError("Transaction date is required.");
      return;
    }
    try {
      const response = await apiClient.importTransactions({
        source: "MANUAL",
        audit,
        transactions: [
          {
            rawMerchantName: rawMerchantName.trim(),
            amountCents,
            transactionDate: new Date(transactionDate).toISOString(),
            postedDate: postedDate
              ? new Date(postedDate).toISOString()
              : undefined,
            userCardId: userCardId || undefined,
            observedCategory: observedCategory
              ? (observedCategory as MerchantCategory)
              : undefined,
            observedMcc: observedMcc.trim() || undefined,
          },
        ],
      });
      setResult(response.imported[0] ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section>
      <PageHeader
        title="Import Transaction"
        description="Add a posted transaction manually and optionally audit it immediately."
      />
      <section className="panel">
        <form className="form-grid" onSubmit={submit}>
          <label>
            Merchant name
            <input
              value={rawMerchantName}
              onChange={(event) => setRawMerchantName(event.target.value)}
            />
          </label>
          <label>
            Amount
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="50.00"
            />
          </label>
          <label>
            Transaction date
            <input
              type="date"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
            />
          </label>
          <label>
            Posted date
            <input
              type="date"
              value={postedDate}
              onChange={(event) => setPostedDate(event.target.value)}
            />
          </label>
          <label>
            Card used
            <select
              value={userCardId}
              onChange={(event) => setUserCardId(event.target.value)}
            >
              <option value="">Unknown card</option>
              {wallet.data?.map((card) => (
                <option value={card.id} key={card.id}>
                  {card.nickname || card.card.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observed category
            <select
              value={observedCategory}
              onChange={(event) => setObservedCategory(event.target.value)}
            >
              <option value="">Unknown</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observed MCC
            <input
              value={observedMcc}
              onChange={(event) => setObservedMcc(event.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={audit}
              onChange={(event) => setAudit(event.target.checked)}
            />{" "}
            Audit immediately
          </label>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit">Import transaction</button>
        </form>
        {!userCardId ? (
          <p className="muted">
            Without a card, the audit may be inconclusive.
          </p>
        ) : null}
      </section>
      {result ? <ImportResultCard result={result} /> : null}
    </section>
  );
}

type ImportResult = {
  transaction: Transaction;
  status: "created" | "existing";
  outcome?: RecommendationOutcome;
};

function ImportResultCard({ result }: { result: ImportResult }) {
  return (
    <section className="panel result-panel">
      <h2>Transaction {result.status}</h2>
      <p>
        {result.transaction.rawMerchantName} for{" "}
        <MoneyValue cents={result.transaction.amountCents} />
      </p>
      <div className="button-row">
        <Link className="button" to={`/transactions/${result.transaction.id}`}>
          Open transaction
        </Link>
        {result.outcome ? (
          <Link className="button secondary" to="/outcomes">
            View outcomes
          </Link>
        ) : null}
      </div>
      {result.outcome ? (
        <article className="list-card">
          <OutcomeBadge type={result.outcome.outcomeType} />
          <p>{result.outcome.explanation}</p>
        </article>
      ) : null}
    </section>
  );
}
