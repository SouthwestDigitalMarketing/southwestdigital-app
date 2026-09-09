# Environment variables

Moved out of `HANDOFF.md` on 2026-09-08. Every value below is a secret unless
marked otherwise; none may be committed or exposed through a `NEXT_PUBLIC_*`
variable.

Required for full functionality:

| Var | Purpose | Where |
|---|---|---|
| `DATABASE_URL` | Runtime Prisma queries (Supabase pgbouncer :6543) | `.env.local` and prod |
| `DIRECT_DATABASE_URL` | Schema operations (Supabase :5432) | `.env.local` and prod |
| `AUTH_SECRET` | JWT signing + fallback encryption key | `.env.local` and prod |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth login | prod |
| `AUTH_EMAIL_SERVER` / `AUTH_EMAIL_FROM` | Magic link email (nodemailer) | prod |
| `AUTH_RESEND_KEY` | Was used by cancellation notice; now unused after Zoho wiring. Still used by login magic link Resend path? Verify. | prod (verify) |
| ~~`AUTH_URL`~~ / ~~`NEXTAUTH_URL`~~ | **Must stay unset.** `src/auth.ts:14` throws at import if either is present — this deployment serves multiple trusted hostnames. Use `PLATFORM_BASE_URL` instead. | never |
| `STRIPE_SECRET_KEY` | Stripe API | `.env.local` and prod |
| `PLATFORM_BASE_URL` | Platform origin. Locks OAuth callback origins (Zoho, YouTube), decides secure auth cookies, and identifies the platform hostname. Must be HTTPS outside local development or `src/auth.ts` throws. | **prod required** |
| `INTEGRATION_ENCRYPTION_KEY` | Dedicated encryption key for stored OAuth tokens. Falls back to `AUTH_SECRET`. Rotating invalidates all stored tokens. | prod recommended |
| `ZOHO_MAIL_CLIENT_ID` | Zoho OAuth app | `.env.local` and prod |
| `ZOHO_MAIL_CLIENT_SECRET` | Zoho OAuth app | `.env.local` and prod |
| `YOUTUBE_OAUTH_CLIENT_ID` / `YOUTUBE_OAUTH_CLIENT_SECRET` | YouTube brand connection | prod optional |

Zoho on Vercel: register a **separate** OAuth app for prod (not shared with local). See `docs/email-connections/zoho-setup.md` §2b.


## A note on review-request links

`src/app/(app)/reviews/actions.ts` still builds public review links from
`AUTH_URL`, with a localhost fallback. Because `AUTH_URL` must stay unset, those
links currently fall back to localhost in every supported configuration. This is
a known open defect — see `docs/SWAPP-REVIEW-AND-ROADMAP.md`, P1 "Review
requests are not ready for another firm". Resolve public URLs from verified
brand configuration instead.
