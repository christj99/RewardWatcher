# Jobs and Scheduler

Phase 19 adds a small database-backed job runner for operational jobs.

## Jobs

- `WEEKLY_AUDIT_EMAIL`: sends weekly audit summaries.
- `REMINDER_DIGEST`: sends upcoming reminder digests.
- `ADMIN_ALERT`: sends operational admin alerts.
- `PLAID_SYNC_ALL`: syncs eligible Plaid users with consent and entitlement.
- `STATEMENT_CREDIT_USAGE_GENERATION`: estimates statement credit usage.
- `EVAL_KILL_TEST_SNAPSHOT`: runs the kill-test evaluation and stores summary output.

## Environment

The scheduler is off unless explicitly enabled:

```env
SCHEDULER_ENABLED=false
SCHEDULER_INSTANCE_ID=
SCHEDULER_TIMEZONE=UTC
SCHEDULE_WEEKLY_AUDIT_EMAIL_CRON=0 9 * * 1
SCHEDULE_REMINDER_DIGEST_CRON=0 9 * * *
SCHEDULE_ADMIN_ALERT_CRON=0 8 * * *
SCHEDULE_PLAID_SYNC_ALL_CRON=
SCHEDULE_STATEMENT_CREDIT_USAGE_CRON=0 4 * * *
SCHEDULE_EVAL_KILL_TEST_CRON=
```

Cron expressions use five fields and are evaluated by the v0 in-process scheduler in UTC.

## Running Jobs

Existing CLI commands now create `ScheduledJobRun` records with trigger `CLI`:

```sh
pnpm jobs:weekly-audit-email --dryRun=true
pnpm jobs:reminder-digest --dryRun=true
pnpm jobs:admin-alerts --dryRun=true
```

Admins can also trigger jobs from the admin app or `POST /v1/admin/jobs/run`.

## Idempotency and Locks

Each run is recorded in `ScheduledJobRun`. A job can provide an idempotency key; if a prior `SUCCEEDED` or `SKIPPED` run exists for that key, the runner returns it instead of running again.

`ScheduledJobLock` prevents concurrent runs of the same job name. Locks expire after 15 minutes by default so stale worker exits do not permanently block jobs.

## Deployment Caveat

The v0 scheduler is intentionally simple. Run it in only one API/worker instance, or rely on the database lock to prevent duplicate execution. A managed external scheduler or queue can be added later if the product needs horizontally distributed workers.

No marketing automation, SMS/push, tracking, or LLM summaries are part of this system.
