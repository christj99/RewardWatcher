import { NavLink } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.js";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/wallet", label: "Wallet" },
  { to: "/lookup", label: "Lookup" },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/transactions", label: "Transactions" },
  { to: "/audit/weekly", label: "Weekly Audit" },
  { to: "/offers", label: "Offers" },
  { to: "/reminders", label: "Reminders" },
  { to: "/credits", label: "Credits" },
  { to: "/feedback", label: "Feedback" },
  { to: "/settings", label: "Settings" },
];

export function Nav() {
  const auth = useAuth();

  return (
    <nav className="nav" aria-label="Primary navigation">
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.to === "/"}>
          {link.label}
        </NavLink>
      ))}
      <button
        className="nav-button"
        type="button"
        onClick={() => void auth.logout()}
      >
        Logout
      </button>
    </nav>
  );
}
