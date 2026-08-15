# Authentication and active-brand context

## Identity

One normalized email maps to one global user. A user must be pre-invited through either a brand membership or a platform role before Google or email authentication succeeds. A successful first sign-in activates the invited user and invited memberships.

Supported methods:

- Google OIDC with a verified Google email
- one-time email magic links delivered through Resend

Unknown users, suspended users, and users without platform or brand access are denied. Magic-link requests use a non-enumerating confirmation message.

The Auth.js route accepts requests only on the configured platform hostname or a verified app hostname. Unknown `Host` values receive a generic not-found response before Auth.js handles the request. Platform administration routes also require the configured operator hostname in addition to an active platform role.

Do not set `AUTH_URL` or `NEXTAUTH_URL`. Either variable would collapse this multi-host deployment onto one origin. `PLATFORM_BASE_URL` and `AUTH_REDIRECT_PROXY_URL` have separate, explicit responsibilities. The platform uses a full `swd-authjs` cookie namespace so legacy site cookies cannot be mistaken for platform sessions or OAuth state during a DNS cutover or rollback.

## Custom-domain OAuth

Set `AUTH_REDIRECT_PROXY_URL` to the stable Southwest-controlled Auth.js base, for example:

```text
https://admin.southwestdigital.io/api/auth
```

Register its provider callback with Google:

```text
https://admin.southwestdigital.io/api/auth/callback/google
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

A brand-only user cannot use the operator hostname as a portal entry point. A Southwest platform administrator may enter through a verified brand hostname when intentionally supporting that brand; current authorization gives platform `OWNER` and `ADMIN` roles operational access across non-deleted brands.

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
