# Chrome Extension Manual Smoke

1. Start the API and web app with the same database used for smoke tests.
2. Build the extension with `pnpm --filter @rewards-audit/extension build`.
3. Load `apps/extension/dist` as an unpacked Chrome extension.
4. Log in to the web app as `beta@example.com` / `Password12345!`.
5. In Settings, create an extension pairing token.
6. Open the extension options page, paste the token, and pair the extension.
7. Visit a checkout-like page such as `https://target.com/checkout`.
8. Confirm the overlay appears only after merchant and checkout detection.
9. Confirm the overlay shows card name, explanation, confidence, warnings, disclosure, dismiss, and View receipt.
10. Confirm View receipt opens the web app recommendation receipt.
11. Dismiss the overlay and refresh the page; it should not reappear for the dismissed URL.
12. Mute the merchant and confirm the overlay stays hidden.
13. Clear the stored extension token and reload a checkout page; the extension should fail quietly without blocking checkout.
14. Stop the API and reload a checkout page; the extension should not crash or modify the page.

Safety checks:

- Do not autofill or modify payment fields.
- Do not read or store card numbers.
- Do not intercept checkout submission.
- Do not log raw recommendation payloads or tokens in production mode.
