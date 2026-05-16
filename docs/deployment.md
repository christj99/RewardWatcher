# Deployment Runbook

Rewards Audit is deployed as separate API, user web, admin web, and Chrome extension artifacts backed by Postgres.

## Services

- Postgres: primary database for product data, auth sessions, jobs, audit logs, billing, and privacy records.
- API: Fastify service. Run `pnpm db:migrate` before starting a new release.
- Web app: static Vite build from `apps/web`.
- Admin app: static Vite build from `apps/admin`.
- Scheduler: optional in-process scheduler. For v0, run it in only one API or worker instance.
- Extension: build from `apps/extension/dist` and publish/load as a Chrome MV3 bundle.

## Required Production Env

- `APP_ENV=production`
- `NODE_ENV=production`
- `DATABASE_URL`
- `SECRET_ENCRYPTION_KEY` with at least 32 characters
- `API_PUBLIC_URL`
- `WEB_PUBLIC_URL`
- `ADMIN_PUBLIC_URL`
- `CORS_ORIGIN` with explicit origins, never `*`
- `SESSION_COOKIE_SECURE=true`
- `ALLOW_DEV_AUTH_HEADER=false`

Optional feature env:

- Stripe: set `STRIPE_ENABLED=true`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_ANNUAL`, and optional monthly price.
- Plaid: set `PLAID_ENABLED=true`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, environment, products, countries, and webhook URL.
- Email: `EMAIL_PROVIDER=postmark`, `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM`.
- Sentry-compatible reporting: `SENTRY_DSN`.
- Scheduler: `SCHEDULER_ENABLED=true`, `SCHEDULER_INSTANCE_ID`, and schedule cron envs.

Run `pnpm check:prod-config` before deploying. It prints a safe summary and does not print secrets.

## Health Checks

- `GET /health`: simple load balancer response, `{ "status": "ok" }`.
- `GET /ready`: database/env readiness with version and uptime.
- `GET /v1/admin/diagnostics`: admin-only safe diagnostics.
- `GET /v1/admin/ops/summary`: admin-only operational counters.

## Release Steps

1. Build artifacts with `pnpm build`.
2. Validate config with `pnpm check:prod-config`.
3. Apply migrations with `pnpm db:migrate`.
4. Start API with `pnpm start:api` or `node apps/api/dist/index.js`.
5. Deploy static web/admin assets.
6. Verify `/health`, `/ready`, login, recommendation creation, and admin diagnostics.

Do not run `pnpm db:seed` in production unless intentionally loading demo data.

## Rollback Notes

- Prefer rolling back app containers first.
- Database migrations may need a planned restore or forward fix; Prisma deploy migrations are not automatically reversible.
- Disable `SCHEDULER_ENABLED` before rollback if jobs are misbehaving.

## Secret Rotation

- Stripe, Plaid, Postmark, and Sentry keys can be rotated at the provider and redeployed.
- `SECRET_ENCRYPTION_KEY` protects encrypted Plaid tokens. Rotating it requires a re-encryption plan.

## Incident Levers

- Disable scheduler: `SCHEDULER_ENABLED=false`.
- Disable Plaid feature routes: `PLAID_ENABLED=false` and remove Plaid credentials if needed.
- Disable Stripe feature routes: `STRIPE_ENABLED=false`.
- Inspect admin audit logs, job runs, email logs, Stripe webhook failures, and Plaid sync failures from the admin app.

No adtech analytics, LLM monitoring, or external scheduler service is part of this v0 deployment.
