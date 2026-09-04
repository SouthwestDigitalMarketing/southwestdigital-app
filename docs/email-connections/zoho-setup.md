# Zoho Mail OAuth — one-time setup

This unlocks the "Connect Zoho Mail" button in **Settings → Email connections**. You do this once per environment (local, then production). It takes about five minutes.

## 1. Register the app in the Zoho API Console

1. Sign in to <https://api-console.zoho.com/> using the Zoho account whose mailboxes you want to connect. Pick the region of that account (e.g. **zoho.com** for US; **zoho.eu** for EU).
2. Click **Add Client** → **Server-based Applications**.
3. Fill in:
   - **Client Name**: `Southwest Digital App` (or per environment: "SWApp — local", "SWApp — production").
   - **Homepage URL**: your app's base URL (local: `http://localhost:3000`, production: your Netlify URL).
   - **Authorized Redirect URIs**: add exactly one entry:
     - Local: `http://localhost:3000/api/email-connections/zoho/callback`
     - Production: `https://<your-domain>/api/email-connections/zoho/callback`
4. Click **Create**.
5. Copy the **Client ID** and **Client Secret**.

The scopes we request (`ZohoMail.messages.CREATE`, `ZohoMail.accounts.READ`) don't need pre-registration — the consent screen at connect time shows them to the user.

## 2. Add the credentials to your environment

Add these two variables to `.env.local` (development) and to Netlify's environment (production):

```
ZOHO_MAIL_CLIENT_ID=1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXX
ZOHO_MAIL_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Restart the dev server (`npm run dev`) after editing `.env.local`. Netlify needs a redeploy for env-var changes to apply.

**Optional but recommended for production:**

```
PLATFORM_BASE_URL=https://<your-domain>
INTEGRATION_ENCRYPTION_KEY=<32+ random chars>
```

- `PLATFORM_BASE_URL` locks the OAuth callback origin — safe when the app runs behind Netlify's reverse proxy.
- `INTEGRATION_ENCRYPTION_KEY` gives token encryption its own key instead of deriving from `AUTH_SECRET`. Rotate this separately from session signing.

## 3. Connect your first mailbox

1. Log into the app.
2. Go to **Settings → Email connections**.
3. Pick your Zoho region and click **Connect Zoho Mail**.
4. Approve on the Zoho consent screen.
5. You'll be sent back to Settings. The card should show your email address and status: `ACTIVE`.
6. Click **Send a test email** to your own address to confirm end-to-end delivery. It should land in your inbox within a few seconds, and appear in your Zoho **Sent** folder.

## 4. When something goes wrong

| Symptom | What to check |
|---|---|
| "Zoho OAuth is not configured" banner | Env vars aren't set or dev server wasn't restarted. |
| Redirect URI mismatch on the Zoho consent screen | The URI in Step 1 must be an exact string match, including scheme and trailing path. |
| "Zoho didn't issue a refresh token" | The Zoho API Console app must be **Server-based Application**, not **Self Client** or **Non-browser**. |
| `EPERM` on `prisma generate` on Windows | The dev server is holding the Prisma DLL. Stop `npm run dev`, run `npx prisma generate`, then start again. |
| Test email 401/403 | Refresh token was revoked or missing scopes. Disconnect from Settings and reconnect. |

## 5. What's stored

Per connection (one per staff member per brand):

- Email address, display name, Zoho `accountId`, region.
- Access token (encrypted at rest with AES-256-GCM) and its expiry.
- Refresh token (encrypted at rest).
- Status, last error, last verified timestamp.

Disconnecting from Settings revokes the refresh token at Zoho (best-effort) and deletes the row.

## 6. Adding Gmail or Microsoft later

The provider enum, encryption, storage, and UI already reserve slots for `GMAIL`, `MICROSOFT`, and `SMTP`. To enable one:

1. Register the OAuth app with the provider.
2. Add a `<provider>OAuth.ts` (state helpers) and `<provider>Mail.ts` (token exchange + send) alongside the Zoho versions.
3. Add `/api/email-connections/<provider>/{connect,callback}` routes mirroring the Zoho pair.
4. Flip that provider's `status` in `src/lib/emailConnections/providers.ts` from `coming-soon` to `available`.
5. Extend `getFreshAccessToken` and the test-send route to dispatch on the new provider.
