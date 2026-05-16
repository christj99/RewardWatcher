# Rewards Audit Chrome Extension

Manifest V3 extension MVP for checkout-time card recommendations.

## What It Does

- Detects checkout-like merchant pages.
- Resolves the merchant through the local Rewards Audit API.
- Creates a persisted `RecommendationEvent` through `POST /v1/recommendations`.
- Shows a small non-blocking overlay with the recommended card, explanation, confidence, expected value, warnings, disclosure text, dismiss control, and receipt link.

## Safety Boundaries

- Does not read, store, or transmit payment card numbers.
- Does not autofill payment fields.
- Does not modify checkout forms.
- Does not intercept payments, Apple Pay, or Google Pay.
- Does not use LLMs or sponsored placement logic.

## Local Configuration

The extension uses Vite env variables at build time:

- `VITE_API_BASE_URL`, default `http://localhost:3000`
- `VITE_WEB_APP_BASE_URL`, default `http://localhost:5173`
- `VITE_DEV_USER_EMAIL`, default `beta@example.com`

The extension sends `x-user-email` with `VITE_DEV_USER_EMAIL`. This is local beta/dev auth only.
API calls are proxied through the Manifest V3 background service worker so checkout pages do not need to make direct cross-origin requests to localhost.

## Build

```bash
pnpm --filter @rewards-audit/extension build
```

The loadable extension is written to `apps/extension/dist`.

For watch mode:

```bash
pnpm dev:extension
```

## Load In Chrome

1. Start Postgres and the API on `http://localhost:3000`.
2. Start the web app on `http://localhost:5173`.
3. Build the extension.
4. Open `chrome://extensions`.
5. Enable Developer mode.
6. Click "Load unpacked".
7. Select `apps/extension/dist`.

## Manual QA Checklist

1. Start API on localhost:3000.
2. Start web app on localhost:5173.
3. Build extension.
4. Load unpacked extension from `apps/extension/dist`, or click reload on the extension after rebuilding.
5. Visit a seeded merchant checkout-like URL or `apps/extension/test-pages/checkout.html`.
6. Confirm overlay appears only on checkout-like pages.
7. Confirm a recommendation event is created.
8. Confirm "View receipt" opens the web app recommendation detail.
9. Confirm dismiss works.
10. Confirm non-checkout pages do not show the overlay.
