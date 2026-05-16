import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader.js";

export function NotFoundPage() {
  return (
    <section>
      <PageHeader
        title="Page Not Found"
        description="That beta surface is not here."
      />
      <Link className="button" to="/">
        Return to dashboard
      </Link>
    </section>
  );
}
