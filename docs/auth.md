# Authentication

Phase 17 adds first-party email/password authentication for the private beta.

## Design

- Users register or log in with email and password.
- Passwords are hashed with `bcryptjs`; raw passwords are never stored.
- Successful login creates an `AuthSession` row and returns an HTTP-only cookie.
- API requests from the user and admin web apps use `credentials: "include"`.
- The Chrome extension uses a pairing-token flow and then sends a bearer session token.
- Local/test dev-header auth remains available only when explicitly enabled.

## Local Seed Credentials

Seeded users have local credentials for development:

- `beta@example.com` / `Password12345!`
- `admin@example.com` / `AdminPassword12345!`
- `free@example.com` / `FreePassword12345!`

These are seed-only credentials for local/private beta development.

## Session Cookies

Session cookies use:

- Name from `SESSION_COOKIE_NAME`, default `rewards_audit_session`
- HTTP-only
- `SameSite=Lax`
- `Secure` in production or when `SESSION_COOKIE_SECURE=true`
- TTL from `SESSION_TTL_DAYS`, default `30`

The API stores only the session token hash. Revoked or expired sessions are rejected.

## Password Reset

Password reset is token-based:

1. `POST /v1/auth/password-reset/request`
2. `POST /v1/auth/password-reset/confirm`

In development and test, the request endpoint returns `devResetToken` so the flow can be exercised without email delivery. In production, the token is not returned; production email delivery is intentionally deferred.

## Dev Header Auth

The old `x-user-email` flow is now a development/test escape hatch only:

- `NODE_ENV` must not be `production`
- `ALLOW_DEV_AUTH_HEADER=true`
- `x-user-email` or `DEV_USER_EMAIL` must identify a seeded user

In production, `x-user-email` is ignored. If an invalid cookie or bearer token is explicitly presented, the request returns `401` rather than falling through to dev auth.

The web, admin, and extension clients no longer send dev headers by default. Set `VITE_USE_DEV_AUTH_HEADER=true` only for local debugging.

## Extension Pairing

The extension no longer needs a dev user header.

1. Log into the web app.
2. Open Settings and create an extension pairing token.
3. Open the extension options page.
4. Paste the one-time token.
5. The extension exchanges it for a bearer session token and stores it in `chrome.storage.local`.

Pairing tokens expire quickly and can be used once. The bearer session token is stored as a normal hashed `AuthSession` on the API side.

## Admin Access

Admin login uses the same `/v1/auth/login` route. Admin-only routes still check `user.isAdmin`.

## Future Hardening

This phase does not add OAuth, SSO, MFA, passkeys, device management, or production email delivery. CSRF protection currently relies on `SameSite=Lax`, JSON APIs, explicit CORS origins, and no wildcard credentialed CORS; a dedicated CSRF token can be added in a later hardening pass.
