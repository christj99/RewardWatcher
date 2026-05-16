# Security and Privacy Notes

Rewards Audit handles sensitive beta data such as transactions, Plaid connection metadata, wallet cards, recommendations, outcomes, corrections, reminders, and offer activation states.

## Secrets

Plaid access tokens are encrypted with AES-256-GCM through `SECRET_ENCRYPTION_KEY`. Public tokens, access tokens, cookies, authorization headers, API keys, encrypted secrets, Plaid account identifiers, and emails are redacted from application logs and admin audit-log JSON.

## Logging

API logging uses deterministic redaction before writing metadata. Production error responses return structured generic errors with request IDs and do not expose stack traces.

## Admin Audit Logs

Admin mutation routes write `AdminAuditLog` records for core rewards-data changes, offer expiration, earning-rule retirement, correction updates, and review-task updates. Audit payloads are redacted before storage.

## Data Deletion

Users can delete Plaid data, delete transaction data by source, or request account deletion/anonymization. Shared rewards data such as issuers, cards, rules, merchants, offers, and posting profiles is retained. Deletion from backups is out of scope for this local/private beta.

## Local Dev Caveats

Local beta auth still uses `x-user-email`, `DEV_USER_EMAIL`, and the seeded beta user. This is not production authentication.

## Incident Response Placeholder

For a suspected secret or transaction-data exposure, rotate affected Plaid credentials, rotate `SECRET_ENCRYPTION_KEY` after re-encryption planning, preserve relevant admin audit logs, and notify affected beta users once impact is understood.
