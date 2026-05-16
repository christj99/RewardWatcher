# Notifications

Phase 18 adds transactional email delivery and manually triggered notification jobs.

## Providers

Set `EMAIL_PROVIDER`:

- `console`: default for development and tests. It writes redacted metadata to the console and stores sent emails in memory for tests.
- `postmark`: sends through Postmark using `POSTMARK_SERVER_TOKEN`.

Environment:

```bash
EMAIL_PROVIDER=console
EMAIL_FROM="Rewards Audit <no-reply@example.com>"
EMAIL_REPLY_TO=
POSTMARK_SERVER_TOKEN=
APP_WEB_URL=http://localhost:5173
ADMIN_WEB_URL=http://localhost:5174
ADMIN_ALERT_EMAILS=
ADMIN_RECOMMENDATION_ERROR_ALERT_THRESHOLD=5
```

Missing Postmark configuration does not break app startup. Sending fails clearly if `EMAIL_PROVIDER=postmark` without a token.

## Email Logs

Every send attempt creates an `EmailLog` with:

- redacted recipient
- email type
- provider
- status
- idempotency key
- redacted metadata

The log does not store email bodies or raw reset tokens.

## Notification Preferences

Users can manage email preferences at `/v1/notification-preferences`.

User-toggleable:

- weekly audit emails
- reminder digest emails
- billing notices

Always transactional:

- password reset
- privacy notices

## Password Reset

`POST /v1/auth/password-reset/request` sends a password reset email for existing users.

In development and test it also returns `devResetToken` for local use. In production, the token is only sent by email.

## Manual Jobs

No scheduler is installed in this phase. Jobs are CLI/manual only:

```bash
pnpm jobs:weekly-audit-email --dryRun=true
pnpm jobs:reminder-digest --dryRun=true
pnpm jobs:admin-alerts --dryRun=true
```

Useful options:

- `--userId=...`
- `--startDate=YYYY-MM-DD`
- `--endDate=YYYY-MM-DD`
- `--lookaheadDays=7`

## Idempotency

Jobs use deterministic keys:

- `weekly-audit:{userId}:{weekStart}:{weekEnd}`
- `reminder-digest:{userId}:{YYYY-MM-DD}`
- `admin-alert:{YYYY-MM-DD}:{email}`

If a matching sent log already exists, the job skips the duplicate send.

## Privacy Boundaries

Emails avoid raw transaction payloads, Plaid tokens, secrets, full recommendation snapshots, tracking pixels, and click/open tracking. Weekly audit emails include high-level value summaries and links back to the app.
