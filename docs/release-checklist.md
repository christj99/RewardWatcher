# Release Checklist

## Configuration

- `pnpm check:prod-config` passes.
- `ALLOW_DEV_AUTH_HEADER=false`.
- `SESSION_COOKIE_SECURE=true`.
- `CORS_ORIGIN` contains only deployed web/admin origins.
- `API_PUBLIC_URL`, `WEB_PUBLIC_URL`, and `ADMIN_PUBLIC_URL` are correct.
- Stripe webhook endpoint and signing secret are configured if Stripe is enabled.
- Plaid webhook URL and credentials are configured if Plaid is enabled.
- Postmark sender/domain is verified if Postmark is enabled.
- Sentry DSN is configured if external error reporting is desired.

## Build and Database

- `pnpm install --frozen-lockfile`
- `pnpm prisma validate`
- `pnpm db:generate`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm db:migrate`

Do not seed production unless explicitly loading demo data.

## Smoke Tests

- `/health` returns `{"status":"ok"}`.
- `/ready` returns `ready`.
- Register/login/logout works.
- Basic recommendation request works.
- Chrome extension can create a checkout receipt in a test environment.
- Manual transaction import works.
- Transaction audit and weekly audit work for an entitled test user.
- Plaid sandbox sync works if enabled.
- Stripe checkout test mode flow works if enabled.
- Password reset email sends through the configured provider.
- Privacy deletion works on a disposable test user.
- Admin diagnostics and ops summary render without secrets.

## Scheduler Decision

- Scheduler disabled unless intentionally running jobs.
- If enabled, exactly one instance has `SCHEDULER_ENABLED=true` for v0.
- Check recent job failures after deployment.

## Security Review

- No secrets in logs.
- Admin audit logs are recording mutations.
- Rate limiting enabled.
- Security headers present.
- No wildcard CORS with credentialed requests.
- Dev auth headers ignored in production.

## Rollback

- Keep the previous API image/static assets available.
- Know the last applied migration.
- Disable scheduler first if job behavior is the incident source.
