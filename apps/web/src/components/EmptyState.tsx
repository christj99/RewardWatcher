import { Link } from "react-router-dom";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="state state-empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {actionHref && actionLabel ? (
        <Link className="button" to={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
