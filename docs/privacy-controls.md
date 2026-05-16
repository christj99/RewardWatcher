# Privacy Controls

Phase 14 adds user-facing privacy controls for the beta.

## Plaid Data

`DELETE /v1/privacy/plaid-data` disconnects Plaid where possible, deletes Plaid accounts, and removes Plaid-synced transactions and dependent outcomes. Manual transactions are retained.

## Transaction Data

`DELETE /v1/privacy/transactions` removes the current user's transactions for a requested source (`PLAID`, `MANUAL`, `CSV_IMPORT`, `TEST_FIXTURE`, or `ALL`) and deletes dependent recommendation outcomes. Recommendation receipts are retained unless account deletion is requested.

## Account Deletion

`DELETE /v1/privacy/account` removes or anonymizes user-owned beta data including wallet cards, transactions, outcomes, recommendation events, reminders, credit usage, offer activations, preference rules, Plaid records, consents, corrections, and linked review tasks. The user row is anonymized so privacy request records and admin audit logs remain referentially intact.

## Shared Data Retained

The system preserves shared rewards data: issuers, cards, card versions, earning rules, benefits, statement credits, merchants, URL patterns, posting profiles, curated issuer offers, rule sources, currencies, and valuations.
