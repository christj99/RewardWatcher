export function CorrectionStatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge status status-${status.toLowerCase()}`}>
      {status.replace("_", " ")}
    </span>
  );
}
