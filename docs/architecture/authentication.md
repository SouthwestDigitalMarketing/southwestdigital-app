# Authentication and active-brand context

## Identity

One normalized email maps to one global user. A user must be pre-invited through either a brand membership or a platform role before Google or email authentication succeeds. A successful first sign-in activates the invited user and invited memberships.

Supported methods:

- Google OIDC with a verified Google email
- one-time email magic links delivered through Resend

Unknown users, suspended users, and users without platform or brand access are denied. Magic-link requests use a non-enumerating confirmation message.

## Custom-domain OAuth

Set `AUTH_REDIRECT_PROXY_URL` to the stable Southwest-controlled Auth.js base, for example:

```text
https://app.southwestdigital.example/api/auth
```

Register its provider callback with Google:

```text
https://app.southwestdigital.example/api/auth/callback/google
```

Auth.js places the originating verified client callback in protected OAuth state, uses the stable callback for Google, and returns the browser to the originating client hostname. Do not add an arbitrary hostname to Google merely because it points at the deployment; the matching `BrandDomain` must first be verified and enabled.

## Entry and active brand

1. The request hostname resolves through a verified `BrandDomain`.
2. The hostname controls the login theme.
3. After authentication, `/auth/complete` obtains the user's accessible brands.
4. An accessible entry-host brand becomes active.
5. A host-only, HTTP-only active-brand cookie stores the current selection.
6. Switching brands revalidates access before replacing the cookie.
7. Every page/query revalidates the cookie value against current memberships; the cookie is never authority.

Because unrelated domains cannot share cookies, each custom domain has a separate session. They use the same global identity and sign-in methods. Cross-domain single sign-on would require a separate, explicit one-time-token broker.

## Runtime configuration

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_REDIRECT_PROXY_URL`
- `AUTH_RESEND_KEY`
- `AUTH_EMAIL_FROM`
- `PLATFORM_BASE_URL`
- optional local-only `DEV_BRAND_HOST`

Secrets belong in the deployment provider or local untracked environment files, never Git.

