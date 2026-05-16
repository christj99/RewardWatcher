# Billing and Entitlements

Phase 16 adds a simple Stripe paid beta layer without changing recommendation ranking.

## Environment

Set these only when testing real Stripe flows:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_ANNUAL=
STRIPE_PRICE_ID_MONTHLY=
STRIPE_BILLING_PORTAL_RETURN_URL=http://localhost:5173/settings/billing
STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:5173/settings/billing?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=http://localhost:5173/settings/billing?checkout=cancel
```

Missing Stripe config does not block normal app startup. Billing routes fail clearly until the required Stripe config is present. Tests use a mocked Stripe client and never call Stripe.

## Entitlements

Free users always have `BASIC_RECOMMENDATIONS`.

Active or trialing subscriptions grant:

- `FULL_TRANSACTION_AUDIT`
- `WEEKLY_AUDIT_REPORT`
- `STATEMENT_CREDIT_TRACKING`
- `OFFER_AWARE_RECOMMENDATIONS`
- `ADVANCED_LENSES`
- `PLAID_SYNC`
- `EXTENDED_HISTORY`

Manual and founding beta grants can provide individual entitlements until revoked or expired. Seed data gives `beta@example.com` founding beta grants for local development, while `free@example.com` remains ungated only for free features.

## Gated Features

Premium gates are enforced server-side. Stripe state comes from Checkout/webhooks or server-side Stripe retrieval, not client claims.

The current gated API areas are:

- transaction audit and audited transaction import
- outcomes
- weekly audit reports
- Plaid link/exchange/sync
- statement credit usage tracking
- aspirational recommendation lens

Basic wallet, merchant lookup, practical/cash-out recommendations, receipts, corrections, reminders, and offer activation remain available in the beta.

## Webhooks

Configure Stripe to send webhooks to:

```text
POST /v1/billing/webhook
```

The route verifies the Stripe signature, stores `StripeWebhookEvent` rows for idempotency, and updates local subscription status for checkout completion and subscription lifecycle events.

## Caveat

Local development still uses `x-user-email` dev auth. Production auth is intentionally out of scope for Phase 16.
