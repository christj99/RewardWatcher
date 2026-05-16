# Rewards Audit Admin

Internal curator/admin web app for maintaining rewards data and reviewing data quality.

## Run Locally

Start the API:

```bash
pnpm --filter @rewards-audit/api dev
```

Start the admin app:

```bash
pnpm dev:admin
```

The app runs on `http://localhost:5174` by default.

## Environment

- `VITE_API_BASE_URL`: API base URL, default `http://localhost:3000`
- `VITE_ADMIN_USER_EMAIL`: local dev admin identity, default `admin@example.com`

The admin app uses the existing local beta auth header:

```text
x-user-email: admin@example.com
```

This is not production authentication.

## Route Overview

- `/` dashboard
- `/review-tasks` and `/corrections` review triage
- `/cards`, `/cards/new`, `/cards/:id`, `/cards/:id/edit`
- `/earning-rules`, `/earning-rules/new`, `/earning-rules/:id/edit`
- `/rule-sources`, `/currencies`
- `/merchants`, `/merchants/new`, `/merchants/:id`
- `/offers`, `/offers/new`, `/offers/:id/edit`
- `/recommendation-errors`, `/rule-freshness`
- `/audit-logs`, `/kill-test`

## Boundaries

This app does not add production auth, scraping, LLM tooling, Stripe, email, or scheduled jobs.
