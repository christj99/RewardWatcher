export function JsonDetails({
  title = "Details",
  value,
}: {
  title?: string;
  value?: unknown;
}) {
  if (value === undefined || value === null) {
    return <span className="muted">No details</span>;
  }

  return (
    <details className="json-details">
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
