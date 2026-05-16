# Rewards Audit Private Beta Operations Guide

This guide consolidates the practical setup, third-party configuration, and beta-user QA workflow needed to run and verify the Rewards Audit private beta.

It answers three core questions:

1. What needs to be configured for the app to run?
2. Which third-party apps need setup?
3. What is the beta-user workflow, and what does each step prove?

## Current State

The repo is private-beta ready for local QA. It includes:

- Fastify API with Prisma/Postgres.
- User web app under `apps/web`.
- Admin web app under `apps/admin`.
- Chrome MV3 extension under `apps/extension`.
- First-party email/password auth with HTTP-only sessions.
- Deterministic recommendation and audit engines.
- Plaid private beta syncing.
- Stripe billing and entitlements.
- Transactional email abstraction and manual notification jobs.
- Optional in-process scheduler with job run tracking.
- Privacy deletion, consent records, admin audit logs, redacted logging.
- Beta feedback, support workflow, beta readiness dashboard, smoke scripts, and demo fixture.

The app can run locally without real Stripe, Plaid, Postmark, or Sentry credentials. Those integrations become necessary only when you want real billing, bank syncing, outbound email, error reporting, or production extension distribution.

## Local Setup

### 1. Start Postgres

Postgres is the only required external service for local development.

```powershell
$env:POSTGRES_PORT='5433'
docker compose up -d postgres
```

Set the database URL:

```powershell
$env:DATABASE_URL='postgresql://rewards_audit:rewards_audit_password@localhost:5433/rewards_audit?schema=public'
```

### 2. Install Dependencies

```powershell
corepack pnpm install
```

### 3. Generate, Migrate, And Seed

```powershell
corepack pnpm db:generate
corepack pnpm prisma validate
corepack pnpm db:migrate
corepack pnpm db:seed
```

Optional demo fixture:

```powershell
corepack pnpm beta:seed-demo
```

The demo fixture creates a coherent beta demo user with wallet cards, recommendations, transactions, outcomes, reminders, statement credit usage, offers, review work, an email log, and a job run.

### 4. Start Apps

API:

```powershell
corepack pnpm --filter @rewards-audit/api dev
```

User web app:

```powershell
corepack pnpm --filter @rewards-audit/web dev
```

Admin web app:

```powershell
corepack pnpm --filter @rewards-audit/admin dev
```

Typical local URLs:

- API: `http://localhost:3000`
- User web: `http://localhost:5173`
- Admin web: `http://localhost:5174`

### 5. Seeded Credentials

Local seed users:

- Beta user: `beta@example.com / Password12345!`
- Admin user: `admin@example.com / AdminPassword12345!`
- Free user: `free@example.com / FreePassword12345!`
- Demo user, if demo fixture is run: `demo@example.com / DemoPassword12345!`

## Local Environment Variables

For local development, a minimal environment looks like this:

```env
APP_ENV=development
NODE_ENV=development
DATABASE_URL=postgresql://rewards_audit:rewards_audit_password@localhost:5433/rewards_audit?schema=public

API_PUBLIC_URL=http://localhost:3000
WEB_PUBLIC_URL=http://localhost:5173
ADMIN_PUBLIC_URL=http://localhost:5174
CORS_ORIGIN=http://localhost:5173,http://localhost:5174

SESSION_COOKIE_SECURE=false
ALLOW_DEV_AUTH_HEADER=true

EMAIL_PROVIDER=console
APP_WEB_URL=http://localhost:5173
ADMIN_WEB_URL=http://localhost:5174
```

Local dev can run without real Stripe, Plaid, Postmark, or Sentry settings.

## Production/Private Beta Environment Basics

For a real private beta deployment, use safe production settings:

```env
APP_ENV=production
NODE_ENV=production

API_PUBLIC_URL=https://api.yourdomain.com
WEB_PUBLIC_URL=https://app.yourdomain.com
ADMIN_PUBLIC_URL=https://admin.yourdomain.com
CORS_ORIGIN=https://app.yourdomain.com,https://admin.yourdomain.com

SESSION_COOKIE_SECURE=true
COOKIE_DOMAIN=.yourdomain.com
ALLOW_DEV_AUTH_HEADER=false

SECRET_ENCRYPTION_KEY=replace-with-strong-secret-at-least-32-chars
```

Important production rules:

- Do not use wildcard CORS with cookie auth.
- Do not enable dev auth headers.
- Use HTTPS.
- Use secure cookies.
- Run production config validation before launch.

```powershell
corepack pnpm check:prod-config
```

## Third-Party App Configuration

### Postgres

Required.

The app cannot run without a database. In production, use a managed or durable Postgres instance and run migrations:

```powershell
corepack pnpm db:migrate
```

Do not run seed in production unless you intentionally want seeded/demo records.

### Stripe

Required only for real billing checkout, billing portal, and webhooks.

Local development can show billing status and entitlement state without Stripe credentials. Real checkout requires Stripe test or live credentials.

Configure:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_ANNUAL=price_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:5173/settings/billing?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=http://localhost:5173/settings/billing?checkout=cancel
STRIPE_BILLING_PORTAL_RETURN_URL=http://localhost:5173/settings/billing
```

In Stripe:

1. Create a product.
2. Create annual and/or monthly prices.
3. Enable the Billing Portal.
4. Configure webhook endpoint:

```text
POST https://your-api-domain.com/v1/billing/webhook
```

For local webhook testing, use the Stripe CLI to forward events.

Without Stripe config:

- The rest of the app still works.
- Billing routes fail clearly when real Stripe actions are requested.

### Plaid

Required only for real Plaid Link and transaction syncing.

Configure:

```env
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox
PLAID_PRODUCTS=transactions
PLAID_COUNTRY_CODES=US
PLAID_REDIRECT_URI=
PLAID_WEBHOOK_URL=
PLAID_ENABLED=true
SECRET_ENCRYPTION_KEY=replace-with-strong-secret-at-least-32-chars
```

In Plaid:

1. Create/configure a Plaid app.
2. Use sandbox credentials for local/private beta testing.
3. Configure webhook URL if testing Plaid webhooks.

Important:

- Plaid access tokens are encrypted using `SECRET_ENCRYPTION_KEY`.
- Do not rotate `SECRET_ENCRYPTION_KEY` casually after real encrypted tokens exist.
- Plaid link-token creation requires user consent and `PLAID_SYNC` entitlement.
- Missing Plaid config does not break normal app startup.

### Email Provider

Local default is console email, so no provider is required for local QA.

Use console provider:

```env
EMAIL_PROVIDER=console
EMAIL_FROM="Rewards Audit <no-reply@example.com>"
APP_WEB_URL=http://localhost:5173
ADMIN_WEB_URL=http://localhost:5174
```

For real transactional email, configure Postmark:

```env
EMAIL_PROVIDER=postmark
EMAIL_FROM="Rewards Audit <no-reply@yourdomain.com>"
EMAIL_REPLY_TO=support@yourdomain.com
POSTMARK_SERVER_TOKEN=...
APP_WEB_URL=https://app.yourdomain.com
ADMIN_WEB_URL=https://admin.yourdomain.com
ADMIN_ALERT_EMAILS=ops@yourdomain.com
```

In Postmark:

1. Verify sender or domain.
2. Add server token.
3. Use transactional stream/settings.

The app does not add marketing email, tracking pixels, open tracking, click tracking, SMS, or push notifications.

### Sentry

Optional.

If unset, the app uses a noop error reporter.

Configure:

```env
SENTRY_DSN=https://...
RELEASE_VERSION=...
COMMIT_SHA=...
```

Error reporting redacts sensitive context before sending.

### Chrome Extension

For local development, build and load unpacked:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WEB_APP_BASE_URL=http://localhost:5173
```

Build:

```powershell
corepack pnpm --filter @rewards-audit/extension build
```

Load in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click Load unpacked.
4. Select the built extension output directory.

For real beta distribution, choose either:

- Manual unpacked extension distribution to testers.
- Chrome Web Store private/unlisted distribution.

The extension authenticates through the pairing-token flow and then sends a bearer session token. It should not rely on `x-user-email` in production.

### Scheduler

No third-party scheduler is required.

Default:

```env
SCHEDULER_ENABLED=false
```

To enable the in-process scheduler:

```env
SCHEDULER_ENABLED=true
SCHEDULER_INSTANCE_ID=worker-1
SCHEDULE_WEEKLY_AUDIT_EMAIL_CRON=0 9 * * 1
SCHEDULE_REMINDER_DIGEST_CRON=0 9 * * *
SCHEDULE_ADMIN_ALERT_CRON=0 8 * * *
```

For v0, run only one scheduler instance.

Jobs can also be triggered manually or through CLI scripts.

## What Works Out Of The Box Locally

These work locally without third-party SaaS setup:

- Auth/register/login/logout.
- Recommendations.
- Transaction import and audit.
- Weekly audit reports.
- Admin app.
- Feedback and support workflow.
- Privacy deletion.
- Billing status, without real checkout.
- Plaid status/config error states, without real link/sync.
- Console password reset emails.
- Console/dry-run notification jobs.
- Job run tracking.
- Beta readiness dashboard.
- Smoke scripts.
- Extension local API flow after pairing/config.

## Minimum Real Private Beta Setup

For an actual private beta, configure at least:

1. Production Postgres.
2. Strong `SECRET_ENCRYPTION_KEY`.
3. Production `API_PUBLIC_URL`, `WEB_PUBLIC_URL`, and `ADMIN_PUBLIC_URL`.
4. Correct `CORS_ORIGIN`.
5. Secure session cookies.
6. Postmark if users need password reset and notifications.
7. Stripe if charging users.
8. Plaid if syncing real or sandbox bank transactions.
9. Sentry or equivalent if you want production error visibility.
10. Chrome extension distribution method.

Then run:

```powershell
corepack pnpm check:prod-config
corepack pnpm db:migrate
corepack pnpm build
corepack pnpm smoke:all
```

## Beta User Confirmation Workflow

This workflow verifies the real private-beta operating loop across the user app, API, admin app, extension, billing/entitlements, jobs, privacy controls, and support workflow.

### 1. Start Local Stack

Start Postgres, migrate, seed, and start API/web/admin.

Proves:

- Database is reachable.
- Prisma schema and migrations are valid.
- Seeded beta/admin/demo data exists.
- API and apps boot against the same DB.

### 2. Run Smoke Tests

```powershell
corepack pnpm smoke:all
```

Proves:

- `/health` works.
- `/ready` works.
- Auth login/session/logout works.
- Wallet/card APIs work.
- Recommendations work.
- Transaction import/audit works.
- Weekly audit works.
- Reminders work.
- Jobs dry runs work.
- Admin diagnostics work.
- Privacy deletion works.
- Billing status works.

This is the fastest system-wide sanity check.

### 3. Log Into User Web App

Open `http://localhost:5173` and log in as:

```text
beta@example.com / Password12345!
```

Proves:

- Real session-cookie auth works.
- Protected app routes work.
- The user app no longer depends on dev auth headers.
- Seeded beta user can access private-beta features.

### 4. Check Wallet

Go to Wallet.

Proves:

- User wallet data loads.
- Card/user-card relations are intact.
- Annual fee and welcome bonus fields are visible.
- Authenticated frontend API calls work.

### 5. Create A Recommendation

Create a recommendation for a checkout-like merchant/category/amount.

Proves:

- Recommendation API works.
- Deterministic engine is functioning.
- Persisted `RecommendationEvent` receipt is created.
- Offer-aware recommendation behavior is included when relevant.
- Beta event instrumentation records `RECOMMENDATION_CREATED`.

### 6. Open Recommendation Receipt

Open the recommendation receipt/details page.

Proves:

- Persisted recommendation receipts work.
- Explanation, confidence, warnings, expected value, offers, and snapshots render.
- Feedback/report issue entry point can link to the recommendation.

### 7. Submit Feedback On The Recommendation

Use Report Issue from the receipt or Feedback page.

Proves:

- User feedback API works.
- Linked recommendation ownership validation works.
- Feedback context is redacted and stored.
- Admin triage queue receives the report.
- Beta event instrumentation records `FEEDBACK_SUBMITTED`.

### 8. Import A Transaction

Import a manual transaction for the same user.

Proves:

- Manual import still works.
- Billing entitlement gate allows beta/founding user.
- Transaction records can be created.
- Beta event instrumentation records `TRANSACTION_IMPORTED`.

### 9. Audit The Transaction

Run audit on the imported transaction.

Proves:

- Deterministic audit pipeline works.
- `RecommendationOutcome` is created.
- Missed/captured value calculations still work.
- Offer-aware audit behavior is included.
- Beta event instrumentation records `TRANSACTION_AUDITED`.

### 10. View Weekly Audit

Open weekly audit/report page.

Proves:

- Weekly audit endpoint works.
- Wallet action enrichment works.
- Reminders, credits, and bonus deadlines can appear in the report.
- Premium entitlement gate works for beta user.
- Beta event instrumentation records `WEEKLY_AUDIT_VIEWED`.

### 11. Generate Reminders

Go to Reminders and generate defaults.

Proves:

- Annual fee reminders generate.
- Welcome bonus deadline reminders generate.
- Statement credit reminders generate.
- Default reminder generation is idempotent.

### 12. Generate Statement Credit Usage

Go to Credits and generate usage.

Proves:

- Statement credit tracking works.
- Usage inference from imported/Plaid transactions works conservatively.
- Credit usage records are idempotent.
- Premium entitlement gate works.

### 13. Check Offers

Go to Offers and activate, dismiss, or mark an offer used.

Proves:

- Curated offers are visible.
- User offer activation state works.
- Activated offers can affect recommendations.
- Unactivated offers warn but do not count as guaranteed value.

### 14. Check Billing Page

Go to Settings/Billing.

Proves:

- Entitlement service works.
- Beta/founding grants are recognized.
- Stripe status route works even without real Stripe checkout configured.
- Upgrade/portal error states behave clearly if Stripe env is missing.

### 15. Check Notification Preferences

Go to Settings and update notification preferences.

Proves:

- Notification preferences load.
- Notification preferences update.
- Weekly audit and reminder email preferences work.
- Password reset and privacy notices remain protected transactional flows.

### 16. Request Password Reset

Use Forgot Password.

Proves:

- Reset token is created.
- Console email provider sends/logs in development.
- `EmailLog` is created.
- In dev/test, reset token is surfaced safely for local testing.
- In production, reset token would not be returned in the response.

### 17. Pair Extension

From Settings, create an extension pairing token and paste it into the extension options page.

Proves:

- Extension no longer needs dev auth header.
- One-time pairing token flow works.
- Extension stores bearer session token.
- API accepts extension bearer session.

### 18. Test Extension On Checkout Page

Open a supported checkout-like page, such as Target checkout.

Proves:

- Extension detects checkout-like pages.
- Extension calls recommendation API.
- Backend creates persisted recommendation receipt.
- Overlay renders recommendation, warning, confidence, expected value, disclosure, dismiss/mute, and receipt link.
- Extension report link points to web feedback with recommendation context.
- Non-checkout pages do not show overlay.

### 19. Run Notification Jobs Dry Run

```powershell
corepack pnpm jobs:weekly-audit-email -- --dryRun=true
corepack pnpm jobs:reminder-digest -- --dryRun=true
corepack pnpm jobs:admin-alerts -- --dryRun=true
```

Proves:

- Job code loads.
- Email jobs can compute candidates.
- Dry run does not send real email.
- Job runner records scheduled job runs when routed through the runner.

### 20. Check Admin App

Open `http://localhost:5174` and log in as:

```text
admin@example.com / AdminPassword12345!
```

Proves:

- Admin auth works.
- Admin guard works.
- Admin app uses session cookies.
- Non-admin users are blocked.

### 21. Review Feedback In Admin

Go to Feedback.

Proves:

- User-submitted feedback appears.
- Admin can triage status, severity, assignment, and resolution notes.
- Admin audit log records feedback mutation.

### 22. Review Beta Users

Go to Beta Users.

Proves:

- Beta profile milestones update.
- Active/stuck status can be managed.
- Cohorts, tags, and notes work.
- Support notes can be added.

### 23. Check Beta Readiness

Go to Beta Readiness.

Proves:

- Launch gate aggregation works.
- Config status is visible.
- Job/email/Plaid failures are visible.
- Feedback counts are visible.
- Stuck user count is visible.
- Recommendation error rate is visible.
- High-priority review task count is visible.
- Unresolved privacy requests are visible.

### 24. Check Jobs, Diagnostics, Ops, Email Logs, And Audit Logs

In the admin app, review:

- Jobs
- Diagnostics/Ops
- Email Logs
- Audit Logs

Proves:

- Scheduler/job observability works.
- Email logs are redacted.
- Admin audit logs are redacted.
- Diagnostics expose safe config booleans only.
- Operational failures can be found from the admin app.

### 25. Test Privacy Delete With Disposable User

Use the privacy smoke script or a manual disposable user.

Proves:

- User-owned transactions and outcomes can be deleted.
- Account deletion/anonymization works.
- Shared rewards data remains.
- Privacy requests are recorded and completed.

## Most Important Manual Path

If you only have time for one manual beta-user path, run this:

```text
login
-> wallet
-> recommendation
-> receipt
-> transaction import
-> audit
-> weekly audit
-> feedback
-> admin triage
-> beta readiness
```

This proves the core user loop, support loop, admin loop, and launch-readiness loop.

## Validation Commands

Run these before inviting beta users:

```powershell
corepack pnpm install
corepack pnpm db:generate
corepack pnpm prisma validate
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm build
corepack pnpm test
corepack pnpm lint
corepack pnpm format
corepack pnpm smoke:all
```

For production/private beta config:

```powershell
corepack pnpm check:prod-config
```

## Quick Answer: Is It Automatic?

Local development and QA are mostly ready out of the box after:

1. Starting Postgres.
2. Installing dependencies.
3. Running migrations.
4. Running seed.
5. Starting API/web/admin.

Third-party SaaS setup is not automatic. You must configure:

- Stripe for real paid checkout/portal/webhooks.
- Plaid for real bank linking/syncing.
- Postmark for real outbound email.
- Sentry for production error reporting.
- Chrome extension distribution for real testers.

Without those credentials, local flows still work through console providers, seeded grants, clear config errors, mocked/test paths, and dry-run jobs.
