# Production cutover preflight

Status as observed on 2026-08-15: `app.bookkeepingconroe.com` is a live legacy Netlify hostname pointing to `bc-next.netlify.app`; `admin.southwestdigital.io` does not yet have an A or CNAME record. DNS must not move until the parallel deployment, data rehearsal, and rollback path are ready.

## Decisions and access still required

- Select the production hosting provider and plan, including its custom-domain quota and TLS automation. If Netlify is selected, account for its guidance on [domain aliases](https://docs.netlify.com/manage/domains/configure-domains/add-a-domain-alias/).
- Provision the separate `southwestdigital-app` Supabase project described in [database hosting](database-hosting.md).
- Provide controlled access to DNS for `southwestdigital.io` and each brand domain only during the approved staging/cutover steps.
- Create one Google OAuth web client with `https://admin.southwestdigital.io/api/auth/callback/google` as the exact redirect URI.
- Configure a Southwest-owned Resend sending subdomain, SPF, DKIM, and DMARC; disable click tracking for one-time authentication links.
- Confirm `admin@southwestdigital.io` and `thomas@bookkeepingconroe.com` can receive magic links. A Google alias may return a different primary address, so magic link remains the fallback.

## Application activation gate

The initial seed intentionally creates `DRAFT` brands and `PENDING` domains. A production activation workflow must verify all of the following before it changes a brand to `ACTIVE` and an app domain to `VERIFIED`:

- the hostname is attached to the selected deployment
- DNS resolves to that deployment
- TLS is valid
- the hostname is not the operator hostname
- the login page shows the expected brand
- unknown and disabled hosts are rejected
- an authorized owner can complete a staged login
- rollback ownership and the previous DNS target are recorded

## Authentication cutover

- Keep `AUTH_URL` and `NEXTAUTH_URL` unset.
- Use `PLATFORM_BASE_URL=https://admin.southwestdigital.io`.
- Use `AUTH_REDIRECT_PROXY_URL=https://admin.southwestdigital.io/api/auth`.
- Use the same strong `AUTH_SECRET` across the one deployment serving every hostname.
- Keep production secrets out of preview deployments.
- Verify forwarded `Host` and protocol headers at the selected provider.
- Test a real Google round-trip from a client hostname through the operator callback and back.
- Test real Resend delivery and one-time link expiry on the operator and a staged client hostname.

The platform's `swd-authjs` cookie namespace prevents the new deployment from interpreting the legacy site's Auth.js cookies. Existing legacy magic links will not survive the DNS switch; communicate that users may need to request a new link.

## Bookkeeping Conroe switch

1. Lower DNS TTL in advance.
2. Freeze legacy writes or define and rehearse the final data delta.
3. Capture verified database and Storage backups.
4. Run the final migration rehearsal and acceptance suite.
5. Attach and verify the hostname on the new deployment before changing DNS where the provider permits.
6. Change DNS during the approved window and verify TLS, branding, Google, email, tenant isolation, and error monitoring.
7. Keep the legacy deployment and prior DNS values intact for rollback.
8. Do not destroy or repurpose the legacy Supabase project during initial cutover.
