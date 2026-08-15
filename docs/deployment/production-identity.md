# Production identity configuration

These are the confirmed production identities for the Southwest Digital platform. They are configuration values, not deployment credentials.

| Purpose | Confirmed value |
| --- | --- |
| Southwest operator and login origin | `https://admin.southwestdigital.io` |
| Southwest platform owner | `admin@southwestdigital.io` |
| Bookkeeping Conroe brand owner | `thomas@bookkeepingconroe.com` |
| Southwest brand portal | `https://app.southwestdigital.io` |
| Bookkeeping Conroe brand portal | `https://app.bookkeepingconroe.com` |

## Operator hostname

Production must set:

```text
PLATFORM_BASE_URL=https://admin.southwestdigital.io
AUTH_REDIRECT_PROXY_URL=https://admin.southwestdigital.io/api/auth
```

The Google OAuth client must register this exact redirect URI:

```text
https://admin.southwestdigital.io/api/auth/callback/google
```

`admin.southwestdigital.io` is the stable Southwest-controlled authentication and operator origin. It is not a brand domain and must never resolve to a `BrandDomain` record. `app.southwestdigital.io` remains the themed portal for the Southwest Digital Marketing brand.

Do not configure `AUTH_URL` or `NEXTAUTH_URL`; Auth.js must retain each verified request hostname. Use one `AUTH_SECRET` across the single deployment that serves the operator and all brand hostnames. The dedicated `swd-authjs` cookie namespace prevents stale cookies from the legacy Bookkeeping Conroe deployment from colliding with this app during cutover or rollback.

## Initial owners

The guarded initial seed requires both owner variables explicitly:

```text
INITIAL_PLATFORM_OWNER_EMAIL=admin@southwestdigital.io
INITIAL_BOOKKEEPING_OWNER_EMAIL=thomas@bookkeepingconroe.com
```

The first account receives `PlatformRole.OWNER`; the second receives `BrandRole.OWNER` only for Bookkeeping Conroe. These remain separate assignments. Under the current operator-support policy, platform `OWNER` and `ADMIN` roles can access non-deleted brands without receiving brand memberships; brand-only users cannot enter through the operator hostname.

## Cutover boundary

Do not publish DNS, enable production email delivery, register the OAuth callback, verify a brand domain, activate a brand, or run the seed until the target deployment and database have passed the production preflight. Secrets remain in the deployment provider and untracked local environment files.
