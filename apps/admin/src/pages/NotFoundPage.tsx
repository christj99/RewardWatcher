import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";

export function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="That admin screen is not available."
      />
      <Link to="/">Return to dashboard</Link>
    </>
  );
}
