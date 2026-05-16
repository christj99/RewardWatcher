import { Link } from "react-router-dom";

export function EmptyState({
  title,
  description,
  action,
  to,
}: {
  title: string;
  description?: string;
  action?: string;
  to?: string;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action && to ? <Link to={to}>{action}</Link> : null}
    </div>
  );
}
