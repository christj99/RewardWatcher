# Private Beta QA Guide

This guide is the launch gate companion for the smoke scripts and admin Beta Readiness dashboard.

## 1. Local Setup

1. Start Postgres and apply migrations.
2. Run `pnpm db:seed`.
3. Run `pnpm beta:seed-demo` when you want the richer demo fixture.
4. Start the API, user web app, admin app, and extension build as needed.

Useful commands:

```bash
pnpm smoke:api
pnpm smoke:user
pnpm smoke:admin
pnpm smoke:privacy
pnpm smoke:jobs
pnpm smoke:all
```

Set `SMOKE_API_BASE_URL` if the API is not on `http://127.0.0.1:3000`.

## 2. Seeded Credentials

- Beta user: `beta@example.com` / `Password12345!`
- Admin user: `admin@example.com` / `AdminPassword12345!`
- Free user: `free@example.com` / `FreePassword12345!`
- Demo user: `demo@example.com` / `DemoPassword12345!` after `pnpm beta:seed-demo`

## 3. User Web Smoke Test

1. Log in as `beta@example.com`.
2. Confirm the dashboard loads without API errors.
3. Add/list wallet cards.
4. Create a merchant recommendation.
5. Import a transaction and audit it.
6. Open weekly audit.
7. Generate reminders and statement credit usage.
8. Activate or dismiss an offer.
9. Open Settings and confirm billing, notification preferences, privacy controls, and extension pairing are understandable.

## 4. Admin App Smoke Test

1. Log in as `admin@example.com`.
2. Open Beta Readiness.
3. Review diagnostics, ops summary, job runs, email logs, audit logs, rule freshness, recommendation errors, review tasks, and kill test.
4. Create/update a harmless test merchant.
5. Confirm admin mutation audit logs appear.

## 5. Chrome Extension Manual Test

Use `scripts/smoke/smoke-extension-manual.md`.

Minimum pass:

- pairing succeeds,
- checkout overlay appears on supported checkout-like pages,
- receipt link opens web app,
- dismiss and merchant mute work,
- unauthenticated/API-down cases fail quietly,
- no payment fields are modified.

## 6. Plaid Sandbox Test

1. Configure Plaid sandbox env vars.
2. Grant Plaid consent in Settings.
3. Confirm Plaid entitlement exists for the beta user.
4. Create a link token.
5. Exchange a sandbox public token.
6. Link a Plaid account to a wallet card.
7. Trigger sync.
8. Confirm synced transactions can be audited.

Known limitation: Plaid remains private-beta gated.

## 7. Stripe Test Mode Checkout

1. Configure Stripe test secret, price id, and webhook secret.
2. Log in as `free@example.com`.
3. Open billing settings.
4. Start checkout and complete with a Stripe test card.
5. Deliver webhook locally.
6. Confirm subscription and entitlements update from webhook state, not client claims.

## 8. Password Reset Email Test

1. Use the console provider locally or Postmark in a configured environment.
2. Request a password reset.
3. Confirm the reset email/log contains a reset link and no raw sensitive payloads.
4. Confirm the token works once and old sessions are revoked.

## 9. Weekly Audit Email Job Test

Run:

```bash
pnpm jobs:weekly-audit-email -- --dryRun=true
```

Then run without dry run only in an environment where sending is expected. Confirm idempotency prevents duplicate weekly emails.

## 10. Scheduler Dry-Run Test

1. Keep `SCHEDULER_ENABLED=false` by default.
2. Use Admin Jobs to trigger dry runs.
3. Confirm `ScheduledJobRun` records are created.
4. If enabling scheduler, run only one scheduler instance for v0.

## 11. Privacy Deletion Test

1. Create a disposable user.
2. Add wallet/recommendation/transaction data.
3. Delete transaction data with exact confirmation.
4. Confirm shared card and merchant data remains.
5. Delete account with exact confirmation.
6. Confirm the original login no longer works or the user is anonymized, depending on relation constraints.

## 12. Rollback And Disable Levers

- Disable scheduler: `SCHEDULER_ENABLED=false`.
- Disable Plaid: unset Plaid credentials or set `PLAID_ENABLED=false`.
- Disable Stripe routes operationally: unset Stripe credentials or set `STRIPE_ENABLED=false`.
- Use console email provider: `EMAIL_PROVIDER=console`.
- Disable Postmark sending by removing `POSTMARK_SERVER_TOKEN`.
- Inspect admin audit logs, job runs, email logs, and ops summary before and after rollback.

## 13. Known Limitations

- v0 scheduler is in-process and should run in only one instance.
- No MFA.
- No CSRF token yet; cookie auth relies on SameSite Lax, JSON APIs, and CORS allowlist.
- No mobile native app.
- No automated offer scraping.
- Email templates are intentionally minimal for private beta.
- Plaid remains private-beta gated.
- Stripe billing does not affect recommendation ranking.
