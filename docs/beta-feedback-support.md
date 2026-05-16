# Beta Feedback and Support

Phase 22 adds lightweight internal tooling for learning from private beta users without broad behavioral surveillance.

## What Is Captured

- User-submitted feedback reports with type, severity, title, message, page URL, and small redacted context.
- Optional links to the user's own recommendation receipt, transaction, or audit outcome.
- Admin triage status, assignment, and resolution notes.
- Beta cohorts and per-user beta profiles for invite waves and support status.
- Internal support notes written by admins.
- First-party milestone events for critical product moments such as registration, recommendations, transaction audit, Plaid sync, billing checkout start, privacy deletion request, and feedback submission.

## What Is Not Captured

- Session replay or screen recording.
- Tracking pixels, adtech analytics, or marketing automation.
- Raw Plaid payloads, card numbers, passwords, cookies, auth headers, Stripe secrets, or browser local storage.
- LLM-generated summaries or automated support classification.

## Privacy Boundaries

Feedback context and beta event metadata pass through the existing redaction helper before storage. Users can only attach records that belong to their account. Admin feedback and support routes are admin-only and write audit logs when triage state changes.

## Admin Workflow

1. Open **Feedback** in the admin app to review reports by severity, type, and status.
2. Open a feedback detail to inspect redacted context and linked product records.
3. Set status to `TRIAGED`, `IN_PROGRESS`, `RESOLVED`, or `REJECTED` with resolution notes.
4. Use **Beta Users** to mark users as `STUCK`, add tags, and write internal support notes.
5. Use **Beta Cohorts** to manage invite waves.
6. Check **Beta Readiness** before launches for open/high feedback, stuck users, users missing core milestones, and Plaid-error users.

## Beta Events Are Not Analytics

`BetaEvent` is a narrow operational milestone log. It intentionally avoids pageview/clickstream capture and should only be used to identify whether beta users reached important value moments or got stuck.
