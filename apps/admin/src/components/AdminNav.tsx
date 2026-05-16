import { NavLink } from "react-router-dom";

import { useAdminAuth } from "../hooks/useAdminAuth";

const groups = [
  {
    title: "Dashboard",
    links: [{ to: "/", label: "Overview" }],
  },
  {
    title: "Review Work",
    links: [
      { to: "/review-tasks", label: "Review Tasks" },
      { to: "/corrections", label: "Corrections" },
    ],
  },
  {
    title: "Rewards Data",
    links: [
      { to: "/cards", label: "Cards" },
      { to: "/earning-rules", label: "Earning Rules" },
      { to: "/rule-sources", label: "Rule Sources" },
      { to: "/currencies", label: "Currencies" },
    ],
  },
  {
    title: "Merchants",
    links: [
      { to: "/merchants", label: "Merchants" },
      { to: "/recommendation-errors", label: "Recommendation Errors" },
      { to: "/rule-freshness", label: "Rule Freshness" },
    ],
  },
  {
    title: "Offers",
    links: [{ to: "/offers", label: "Offers" }],
  },
  {
    title: "Governance",
    links: [
      { to: "/feedback", label: "Feedback" },
      { to: "/beta-users", label: "Beta Users" },
      { to: "/beta-cohorts", label: "Beta Cohorts" },
      { to: "/audit-logs", label: "Audit Logs" },
      { to: "/beta-readiness", label: "Beta Readiness" },
      { to: "/email-logs", label: "Email Logs" },
      { to: "/entitlements", label: "Entitlements" },
      { to: "/jobs", label: "Jobs" },
      { to: "/ops", label: "Ops Summary" },
      { to: "/kill-test", label: "Kill Test" },
    ],
  },
];

export function AdminNav() {
  const auth = useAdminAuth();

  return (
    <nav className="admin-nav" aria-label="Admin navigation">
      {groups.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          {group.links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"}>
              {link.label}
            </NavLink>
          ))}
        </section>
      ))}
      <button
        type="button"
        className="admin-nav-button"
        onClick={() => void auth.logout()}
      >
        Logout
      </button>
    </nav>
  );
}
