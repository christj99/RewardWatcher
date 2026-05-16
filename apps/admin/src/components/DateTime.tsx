export function DateTime({ value }: { value?: string | Date | null }) {
  if (!value) {
    return <span className="muted">n/a</span>;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return <span className="muted">Invalid date</span>;
  }
  return <time dateTime={date.toISOString()}>{date.toLocaleString()}</time>;
}
