export function MoneyValue({ cents }: { cents?: number | string | null }) {
  if (cents === undefined || cents === null || cents === "") {
    return <span className="muted">n/a</span>;
  }

  const value = Number(cents) / 100;
  return (
    <span>
      {value.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
      })}
    </span>
  );
}
