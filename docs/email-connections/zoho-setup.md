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

- `PLATFORM_BASE_URL` locks the OAuth callback origin — safe when the app runs behind a reverse proxy (Vercel or Netlify).
- `INTEGRATION_ENCRYPTION_KEY` gives token encryption its own key instead of deriving from `AUTH_SECRET`. Rotate this separately from session signing.

## 2b. Production setup (Vercel)

Do this **once**, in addition to the local setup above. Create a **separate** Zoho OAuth app for production — don't share credentials between local and prod.

1. **Register the prod OAuth app in the Zoho API Console** (<https://api-console.zoho.com/>):
   - Client Name: `SWapp prod` (or similar — distinct from your local app).
   - Homepage URL: `https://<your-vercel-domain>` (use the domain you send clients to — a custom domain if attached, otherwise the `.vercel.app` URL).
   - Authorized Redirect URIs: `https://<your-vercel-domain>/api/email-connections/zoho/callback` (exact match, no trailing slash).
   - Copy the new Client ID + Client Secret.

2. **Add env vars in Vercel** — via the dashboard (Project → Settings → Environment Variables) or CLI if installed (`npm i -g vercel`):

   ```
   ZOHO_MAIL_CLIENT_ID=<prod client id>
   ZOHO_MAIL_CLIENT_SECRET=<prod client secret>
   PLATFORM_BASE_URL=https://<your-vercel-domain>
   INTEGRATION_ENCRYPTION_KEY=<32+ random chars>       # generate once, keep stable
   ```

   Set each variable's scope to at least **Production**. Add **Preview** too if you want preview deployments to be able to test Zoho (requires adding the preview URL to the Zoho redirect URIs too, which is fussy — usually simpler to skip Preview).

   CLI equivalent:
   ```bash
   vercel env add ZOHO_MAIL_CLIENT_ID production
   vercel env add ZOHO_MAIL_CLIENT_SECRET production
   vercel env add PLATFORM_BASE_URL production
   vercel env add INTEGRATION_ENCRYPTION_KEY production
   ```

3. **Redeploy production** — env-var changes only apply to *new* deployments. Either push a commit or trigger a manual redeploy from the Vercel dashboard.

4. **Connect a mailbox on production** — sign in to the production app, go to Settings → Email connections, and connect. First-time consent to a fresh OAuth app is normal.

**Do not** re-use the local `ZOHO_MAIL_CLIENT_ID` in prod. If credentials ever leak, you can revoke one environment without breaking the other, and the consent screen shows the right app name.

**Do not** rotate `INTEGRATION_ENCRYPTION_KEY` after users have connected mailboxes — you'd invalidate every stored refresh token and everyone would have to reconnect. Pick it once, keep it stable, and only rotate under a planned migration.

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
