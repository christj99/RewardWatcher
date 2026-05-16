# Rewards Audit

Trust-first rewards audit system for deterministic, explainable credit card recommendation auditing.

Phase 0 sets up the TypeScript monorepo, backend API, Prisma/Postgres tooling, shared packages, and test infrastructure. It does not implement recommendation logic, card data, merchant data, auth, frontend UI, extensions, or payment integrations.

Phase 1 adds the audit-first Prisma schema and realistic seed dataset for issuers, cards, reward currencies, merchant mappings, user wallet fixtures, recommendation events, transactions, outcomes, corrections, and curator review tasks. It still does not implement recommendation ranking or audit computation logic.

Phase 2 adds the deterministic rewards recommendation engine. Phase 3 exposes users, cards, wallet, merchants, and persisted recommendation receipts through the API. Phase 4 adds correction and curator review workflows.

Phase 5 adds manual transaction import and deterministic audit outcome computation. Users can import posted transactions without Plaid, replay recommendation logic against observed posting data, and persist `RecommendationOutcome` records. Weekly audit reports, Plaid, Stripe, frontend UI, and LLM-based logic are still intentionally not implemented.

Phase 6 adds `GET /v1/audit/weekly`, a deterministic weekly audit report built from persisted `RecommendationOutcome` records. It summarizes captured value, meaningful missed value, top miss, action text, counts, and confidence notes. Email delivery, scheduled workers, Plaid, Stripe, frontend UI, and LLM summaries are still intentionally not implemented.

Phase 7 adds an internal 30-day kill-test evaluation harness. Admins can call `GET /v1/admin/evals/kill-test`, seed deterministic eval fixtures, and run a CLI report that measures persisted audit outcomes for meaningful missed value, recommendation errors, inconclusive outcomes, unmatched outcomes, overrides, and corrections. It does not add frontend UI, email, scheduled jobs, Plaid, Stripe, or LLM analysis.

Phase 8 adds admin-only data operations APIs for curating issuers, cards, card versions, rule sources, currencies, valuations, earning rules, benefits, statement credits, merchants, URL patterns, posting profiles, and data-quality dashboards. It still does not add an admin frontend UI, user frontend UI, Plaid, Stripe, email, scheduled jobs, scraping, or LLM tooling.

Phase 9 adds a responsive beta user web app under `apps/web`. Beta users can manage wallet cards, request recommendations, inspect receipts, submit corrections, import and audit transactions, view outcomes, and review the weekly audit report. It still does not add an admin frontend UI, Chrome extension, Plaid, Stripe, email, scheduled jobs, payment autofill, affiliate tracking, or LLM behavior.

Phase 10 adds a Chrome Manifest V3 extension MVP under `apps/extension`. It detects checkout-like merchant pages, calls the existing API to create persisted recommendation receipts, and shows a non-blocking overlay with the recommended card, explanation, confidence, warnings, and receipt link. It does not read card numbers, autofill payment forms, intercept checkout, add Plaid, Stripe, email, scheduled jobs, Safari/Firefox extensions, affiliate placement, or LLM behavior.

Phase 11 adds optional private-beta Plaid transaction syncing. Beta-enabled users can create Plaid link tokens, exchange sandbox public tokens, store encrypted access tokens, map Plaid accounts to wallet cards, sync posted transactions into the existing `Transaction` model, and run the existing deterministic audit pipeline. Plaid remains optional and gated; manual import still works. This phase does not add public Plaid rollout, Stripe, email, scheduled sync workers, payment initiation, budgeting, or LLM categorization.

Phase 12 adds reminder and statement credit usage tracking. Users can generate annual fee, welcome bonus deadline, and statement credit reminders, estimate credit usage from imported or Plaid-synced transactions, and see wallet action counts in the weekly audit report. It still does not add email delivery, push notifications, scheduled workers, Stripe, public Plaid rollout, LLM advice, or a full annual-fee analyzer.

Phase 13 adds manually curated issuer/card offers and user activation tracking. Admins can create and expire offers, users can mark relevant offers as available, activated, used, dismissed, or expired, and activated offers can affect deterministic recommendation and audit value calculations. Available-but-unactivated offers produce warnings and are not counted as guaranteed value. This phase still does not add scraping, credential collection, offer auto-activation, affiliate placement, Stripe, email, scheduled jobs, or LLM behavior.

Phase 14 adds launch hardening for sensitive financial-data handling: redacted structured logging, security headers, production-safe errors, in-memory rate limiting for sensitive routes, admin mutation audit logs, consent records, privacy deletion routes, and web settings controls for consent and deletion. It still does not add Stripe, email, scheduled jobs, production auth, adtech analytics, or LLM behavior.

## Requirements

- Node.js 22+
- pnpm 9+
- Docker Desktop or another Docker Compose runtime

## Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The API starts on `http://localhost:3000` by default.
The API loads the repo-root `.env` file automatically during local development.

To run the beta web app alongside the API:

```bash
pnpm --filter @rewards-audit/api dev
pnpm --filter @rewards-audit/web dev
```

The web app starts on `http://localhost:5173` by default and uses the API session cookie after login.

To run the internal admin app alongside the API:

```bash
pnpm --filter @rewards-audit/api dev
pnpm dev:admin
```

The admin app starts on `http://localhost:5174` by default and uses the API session cookie after admin login.

Seeded local credentials:

- `beta@example.com` / `Password12345!`
- `admin@example.com` / `AdminPassword12345!`
- `free@example.com` / `FreePassword12345!`

The old development `x-user-email` header can still be enabled locally with `ALLOW_DEV_AUTH_HEADER=true` and `VITE_USE_DEV_AUTH_HEADER=true`, but it is ignored in production.

If port `5432` is already in use, set `POSTGRES_PORT` and update `DATABASE_URL` to match before starting Postgres.

### Plaid Private Beta

Plaid routes are optional and fail clearly unless Plaid is configured. Set these in `.env` when testing Plaid sandbox flows:

```bash
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
PLAID_PRODUCTS=transactions
PLAID_COUNTRY_CODES=US
SECRET_ENCRYPTION_KEY=
```

Use `beta@example.com` for local beta testing; seeded data has `plaidBetaEnabled=true`. Access tokens are encrypted with AES-256-GCM and are never returned by the API. Tests mock the Plaid client and do not call real Plaid.

## Commands

- `pnpm dev` starts the API in development mode.
- `pnpm dev:web` starts the beta user web app in development mode.
- `pnpm dev:admin` starts the internal admin web app in development mode.
- `pnpm dev:extension` watches and rebuilds the Chrome extension bundle.
- `pnpm build` builds all workspaces.
- `pnpm test` runs tests from all workspaces.
- `pnpm lint` type-checks all workspaces.
- `pnpm format` formats the repo with Prettier.
- `pnpm db:generate` generates the Prisma client.
- `pnpm db:migrate` applies existing Prisma migrations.
- `pnpm db:migrate:dev` creates/applies development migrations.
- `pnpm db:seed` seeds local data.
- `pnpm db:studio` opens Prisma Studio.
- `pnpm evals:seed-fixtures` creates repeatable Phase 7 evaluation fixture users and outcomes.
- `pnpm evals:kill-test` runs the 30-day kill-test and writes a JSON report under `evals/reports`.
- `pnpm jobs:weekly-audit-email` runs the manual weekly audit email job.
- `pnpm jobs:reminder-digest` runs the manual reminder digest email job.
- `pnpm jobs:admin-alerts` runs the manual admin alert email job.
- `pnpm check:prod-config` validates production deployment configuration without printing secrets.
- `pnpm beta:seed-demo` creates an idempotent private beta demo user and launch demo data.
- `pnpm smoke:api`, `pnpm smoke:user`, `pnpm smoke:admin`, `pnpm smoke:privacy`, and `pnpm smoke:jobs` run local private beta smoke checks against `SMOKE_API_BASE_URL` or `http://127.0.0.1:3000`.
- `pnpm smoke:all` runs the core smoke suite.
- `pnpm start:api` starts the compiled API after `pnpm build`.

Build the Chrome extension with `pnpm --filter @rewards-audit/extension build`, then load `apps/extension/dist` as an unpacked extension in Chrome.

The db package includes integration tests that expect `DATABASE_URL` or `TEST_DATABASE_URL` to point at a migrated Postgres database. If you use a non-default Postgres port, set the matching URL when running `pnpm test`.

## Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

Readiness and admin diagnostics:

- `GET /ready` checks database readiness and safe runtime metadata.
- `GET /v1/admin/diagnostics` returns admin-only safe diagnostics.
- `GET /v1/admin/ops/summary` returns admin-only operational counters.

## Structure

```text
apps/
  api/          Fastify API app
  admin/        internal admin curation web app
  extension/    Chrome MV3 checkout recommendation extension
  web/          responsive beta user web app
packages/
  db/           Prisma client and seed helpers
  shared-types/ shared TypeScript types
  rewards-engine/ deterministic recommendation and audit logic
prisma/         Prisma schema, migrations, and seed entrypoint
```

## Data Safety

No secrets are committed. Full card numbers should never be stored in this product.

## Phase 15 Admin Frontend

Phase 15 adds a separate internal admin frontend under `apps/admin`. Curators can review open correction work, manage cards, earning rules, rule sources, currencies, merchants, posting profiles, and issuer offers, and inspect rule freshness, recommendation errors, audit logs, and kill-test reports. The app uses the existing admin-only API and local dev header auth; it does not add production auth, scraping, Stripe, email, scheduled jobs, or LLM behavior.

## Phase 16 Stripe Paid Beta

Phase 16 adds Stripe paid beta billing and centralized entitlements. Users can view billing status, start Stripe Checkout, open the Stripe Billing Portal, and receive premium access from active/trialing subscriptions or founding beta/manual grants. Premium gates cover full transaction audit, weekly audit reports, statement credit tracking, Plaid sync, advanced lenses, and extended history; basic wallet and recommendation flows remain free. Billing and affiliate economics do not affect recommendation ranking. This phase still does not add email, scheduled jobs, production auth, affiliate ranking, or LLM behavior.

## Phase 17 Auth Foundation

Phase 17 replaces dev-header-only auth with first-party email/password auth, HTTP-only session cookies, password reset tokens, auth event records, protected user/admin app routes, and a Chrome extension pairing-token flow. Seeded local users have development credentials listed above. Dev header auth remains available only for local/test use and is disabled in production. This phase does not add OAuth, SSO, MFA, production email delivery, or LLM behavior.

## Phase 18 Email Notifications

Phase 18 adds a transactional email provider abstraction, password reset emails, notification preferences, admin email logs, and manual CLI jobs for weekly audit summaries, reminder digests, and admin operational alerts. Development and tests use the console provider by default; Postmark can be enabled with environment configuration. Jobs are deterministic and idempotent, but there is still no scheduler, marketing email, tracking pixels, SMS/push, LLM summaries, or campaign tooling.

## Phase 19 Scheduler and Job Runner

Phase 19 adds database-backed scheduled job run tracking, per-job locks, an optional in-process scheduler, admin job visibility/control, and CLI integration for the existing notification jobs. The scheduler is disabled by default and only runs when `SCHEDULER_ENABLED=true`; production deployments should run it in one API/worker instance for v0. This phase still does not add Redis/BullMQ, SMS/push, marketing automation, external scheduler deployment config, or LLM behavior.

## Phase 20 Production Readiness

Phase 20 adds production deployment readiness and observability: environment validation by runtime context, `/ready`, admin diagnostics, request IDs, request timing logs, a provider-agnostic error reporting abstraction, admin ops summary, production config checks, Docker ignore/API Dockerfile scaffolding, and deployment/release runbooks. This phase does not change recommendation or audit logic and does not add adtech analytics, external queues, or LLM behavior.

## Phase 21 Private Beta QA

Phase 21 adds focused private beta QA coverage: local smoke scripts for API, user, admin, privacy, and job flows; an idempotent `demo@example.com` beta fixture; an admin Beta Readiness launch gate dashboard; and manual QA documentation for web, admin, extension, Plaid sandbox, Stripe test mode, email jobs, scheduler dry runs, and privacy deletion. This phase does not add major product features, new integrations, adtech analytics, or LLM behavior.

## Phase 22 Beta Feedback and Support

Phase 22 adds privacy-conscious beta feedback and support workflow: user-submitted feedback reports, admin triage, beta cohorts/profiles, internal support notes, and first-party milestone events for critical product flows only. Admin Beta Readiness now includes feedback and stuck-user launch signals. This phase does not add adtech analytics, session replay, tracking pixels, public chat vendors, LLM analysis, or changes to recommendation/audit logic.
