# SWapp handoff

Checked on **ripley**, 2026-11-07 (America/Chicago), by Ummon.
`README.md` describes the project; this file records the current branch and
work. Prior handoff notes are archived at
`docs/handoff-archive/2026-11-05-before-mobile-ux-preview.md`.

## Current state

- Branch: `feat/mobile-ux-pass`, at `7dcee9c`. It is 15 commits ahead of
  `origin/main`. Do not push without Tom's explicit instruction.
- Existing uncommitted changes in `CLAUDE.md`, `next.config.ts`, and
  `src/auth.ts` were present before this session and were left intact.
  The latter two allow the phone preview on Ripley's Tailnet address.
- Local preview is running from this checkout and is bound only
  to Ripley's Tailnet address. Verified listening on `100.98.89.93:3001`; an
  unauthenticated `/dashboard` request redirects to `/login`. The phone needs
  Tailscale connected. Open
  `http://100.98.89.93:3001/dashboard` for the MRR dashboard. `/portal` is a
  separate legacy placeholder page. `/login` returned HTTP 200; `/` redirects
  to `/login` when the request has no session.
- Start command for the current preview: `DEV_DASHBOARD_GOALS_BRAND_ID=cmsw5tsnl0000inio6pkh84yy DEV_DASHBOARD_MRR_GOAL=10000 DEV_DASHBOARD_LEAD_MRR_GOAL=10000 npm run dev -- --webpack --hostname 100.98.89.93 --port 3001`.
  Default Turbopack failed because this worktree's `node_modules` symlink points
  to `../southwestdigital-app/node_modules`; Webpack mode starts successfully.
- `npm run dev` and the invoice-history update generated the Prisma client in
  the shared `southwestdigital-app/node_modules/@prisma/client`.
- `src/app/(app)/contacts/[id]/page.tsx` stacks contact details above compact
  client stats and shows paid and open invoices newest first. Build Offer is
  below the history, full width on phones, with larger text and the theme accent
  background. Extra contact settings remain inside More details.
- The read-only BookBot invoice command is in the sibling worktree
  `/home/tom/projects/bookbot-invoice-history` on `feat/invoice-history`. SWapp
  stores all invoice and linked payment rows in `CustomerArSnapshot`. The
  Ripley user timer now runs at 05:00, 10:00, 15:00, and 20:00 America/Chicago.
  It was enabled and tested on 2026-11-07. A live refresh completed at
  14:24 CST, updating 66 invoices. AAA Discount Maid Service invoice `2026-057`
  has a `$0` open balance and a `$150` payment dated `2026-11-07`. QuickBooks
  was read only; no books were changed.
- Prisma migration history is divergent. `prisma migrate status` showed the last
  common migration as `20260815190000_initial_platform_foundation`. Project
  migration guidance directs additive reviewed SQL through `prisma db execute`;
  the invoice-history SQL was applied that way. Do not use `prisma migrate
  deploy`, `prisma migrate dev`, or `prisma db push`.
- Read-only pipeline check on 2026-11-06 found six active Bookkeeping Conroe
  pipelines: Bookkeeping Prospects 1, Client Phase 1 Pipeline, Local Business
  Cards, Pipe Prospects, Referrals, and Reviews. There is no separate monthly,
  one-off, or refuse pipeline; the actual pipeline is named Referrals. Active
  item counts are 0, 1, 0, 51, 1, and 7 respectively. Pipe Prospects stages are
  Prospect, Lead, Talking, Proposed, Won, and Lost. Referrals is Ask, Asked,
  Done. Reviews is Welcome, Portal accepted, Statements requested, Statements
  received, Filed, First close, Check-in, Ask, Fix first, Done. `PipelineItem`
  stores `baseValueUsd`; the legacy pipe interface writes `value_monthly` there,
  while stage `valueMultiplier` supplies a weighted forecast. Only 11 of the
  51 active Pipe Prospects have a positive base value. Separate
  `MeetingLead.amount` and `amountKind` fields allow offer/invoice amounts, but
  do not classify a contract as recurring or one-off. The current pipeline
  dashboard does not show a combined pipeline summary beneath MRR.
- Follow-up read-only comparison with the Sales SQLite source (`pipe where`:
  data host Ripley, `~/.local/share/lochside-sales/sales.db`) found richer deal
  fields than SWapp currently receives. SQLite stores `offer` (bookkeeping,
  on-site, training), `value_monthly`, one-time `amount` plus `kind`, and
  offer-specific `lead_step`. Sales logic treats bookkeeping as monthly service
  and on-site/training as one-time hourly work; Leads steps differ by offer.
  Referrals and Reviews are lifecycle views over won deals. The current Sales
  sync payload sends monthly and one-time amount fields but omits `offer` and
  `lead_step`; SWapp's `MeetingLead` schema has no offer field. This is why the
  Postgres pipeline snapshot cannot yet reliably split recurring and one-time
  forecasts or show the offer-specific lead stages. SQLite was queried
  read-only; no source records were changed.
- `npm run typecheck` and `git diff --check` pass. The dashboard endpoint responds with HTTP 307 to `/login` without a session. No test suite or signed-in phone visual check was run after the latest card change; Tom's screenshot showed the all-pipeline selector took too much space, so the selector was replaced with one Lead MRR dropdown.
- Added monthly MRR and Lead MRR goal fields to Settings and progress bars at the bottom of the two existing cards. Bars use a red-to-green gradient and appear only after a goal is set. Migration: `prisma/migrations/20261107160000_dashboard_mrr_goals/migration.sql`. **Not applied.** `.env` points to the Supabase pooler (`aws-1-us-east-1.pooler.supabase.com`); deployment docs identify the shared production database and prohibit production changes while the migration gates remain open. For the local dev server only, Tom set both goals to `$10,000` for Bookkeeping Conroe via `DEV_DASHBOARD_*` environment variables; the dashboard should show both bars, and Settings shows the preview values as disabled/read-only with a local-only note. No Supabase write was made. Platform brand administration now selects only the theme fields it uses; it no longer selects all columns from `BrandTheme`.
- The `/settings` side-menu item uses normal Next client navigation. The mobile drawer now closes after the pathname changes. A direct full-page load was tried and caused `net::ERR_CONNECTION_ABORTED` on the phone, so it was reverted. Ripley responds locally at port 3001; the signed-in phone route is not yet verified.

## Next step

Tom can refresh the MRR and pipeline dashboard on his phone at
`http://100.98.89.93:3001/dashboard`. Tailscale must be connected and the user
must be signed in. The user timer is enabled on Ripley and uses
`/home/tom/projects/bookbot-invoice-history/bin/qb`; keep that worktree
available while this preview setup is in use. Do not push without Tom's
explicit instruction.

The dashboard has a separate Pipelines section below Revenue, with one Lead MRR card. Expanding it shows Pipe Prospects stage totals in monthly dollars; expanding a stage lists its leads and links to the brand-scoped `/leads/[id]` page. The card reads `PipelineItem.baseValueUsd`, populated by the legacy pipe sync from `value_monthly`; stage totals are unweighted. The previous all-pipeline carousel was removed after Tom's phone screenshot showed it pushed the stages too far down.

Lead MRR displays five action stages: Ask lead to invite us to QBO, Review QBO, Present to decision maker, Collect initial payment, and Get service agreements signed. It excludes `won` and `lost` pipeline items so completed deals and client lifecycle follow-up do not inflate lead MRR; recurring clients with MRR set remain in the Revenue client list. Prospect maps to current `prospect`; QBO access maps to the `qb` lead step and its untagged `talking` fallback; other active pre-won lead steps map to presenting to the decision maker. The current SWapp/Sales data has no payment-received or full-service-agreement stage field, so stages 4 and 5 remain empty until that workflow is tracked in source data. The card labels its total as estimated monthly value; the count is active leads with a positive monthly estimate. No pipeline records or Sales API contracts were changed.

Both MRR cards place the Detail link below the progress bar when expanded. Revenue and pipeline detail pages use the shared `HistoryBackLink`, which returns through browser history to restore the page and scroll position; direct visits fall back to `/dashboard` or `/pipeline` respectively.

This first pass shows lead MRR only. One-time and other pipeline types stay out of this card. Sales SQLite has offer type and cadence, but its sync omits those fields and SWapp `MeetingLead` has no offer classification; do not infer those categories from the current data. A later combined forecast needs an agreed Sales-to-SWapp data contract.
Earlier mobile pipeline concepts are saved at
`public/mockups/pipeline-dashboard-recurring.png`,
`public/mockups/pipeline-dashboard-one-time.png`, and
`public/mockups/pipeline-dashboard-recurring-expanded.png`; the local preview
serves them under `/mockups/` on port 3001. The expanded sample shows a stage
opened to three fictional lead rows, with a cue that tapping a lead opens its
detail page. All amounts, counts, and names in the mockups are illustrative.
The stage values are unweighted sums of lead estimates (`/mo` for recurring;
one-time total for hourly), not probability-weighted forecasts.

`src/app/(app)/AppShell.tsx` now has a mobile-header moon/sun control. It saves
a `light` or `dark` override in this browser's localStorage, keyed by brand ID.
It does not write the saved brand theme or any database setting. A user must
tap the moon once to switch this phone to dark mode; that choice persists on
this device for the active brand.

The dashboard's MRR client list is ordered by monthly revenue descending, then
name. Open overdue balances are shown in 1–30, 31–60, 61–90, and 90+ day buckets
per client. These figures come from the saved QuickBooks invoice snapshot, not a
live check on every page load. The snapshot now refreshes four times daily on
Ripley. No QuickBooks books were changed.

Dashboard navigation follow-up (2026-11-07): Tom's Pixel screenshot showed the
CRM page with the mobile drawer open and Dashboard visible. At 1:50 PM, Ripley
logged successful `GET /dashboard` responses in 4.5 s, 6.9 s, and 7.4 s; the
link worked, but slow server work plus no pending cue made it look inert. The
mobile drawer now closes when an internal link is tapped, and
`src/app/(app)/dashboard/loading.tsx` shows a theme-aware skeleton during the
route transition. `src/app/(app)/dashboard/page.tsx` now starts independent
database reads together and runs YouTube and GA4 work concurrently. `npm run
typecheck` and `git diff --check` pass. A signed-in phone timing after this
change has not yet been observed.

Lead detail maintenance (2026-11-07): `/leads/[id]` now has brand-scoped edit,
archive, and restore controls. Archive sets `MeetingLead.isActive=false`; it
keeps the record and associated rows. Archived leads are listed at
`/pipeline?view=archived` and can be restored there or from their detail page.
Pipeline reads now exclude inactive leads even if the Sales sync reactivates a
`PipelineItem`. Synced leads show which fields are managed by Sales; only local
notes and expected services are editable in SWapp. Tom's screenshot matched the
single active `test` lead (SWapp ID `cmvr1tt22002flc08hefjuq1p`, Sales deal `61`)
for the Bookkeeping Conroe brand. It is now archived in SWapp and verified
`isActive=false`; no Sales SQLite row was changed or deleted. `npm run
typecheck` and `git diff --check` pass. No test suite or signed-in phone visual
check was run.

MRR focus ranking (2026-11-07): active clients are shown in descending MRR
order, with gold, silver, and bronze trophy markers for ranks 1–3 and number
markers after that. Within each expanded Lead MRR pipeline stage, leads are
sorted by estimated MRR descending and numbered from 1. Equal values use name
ascending as a stable tie-breaker. Funnel stages display from Contact the
prospect down to Get service agreements signed. Stage number badges are hidden
in the stage labels; rank numbers remain beside leads. Larger thermometers fill
from blue through cyan and yellow. Collect initial payment is the fully filled,
red thermometer with a gentle shake and pulsing spark. Get service agreements
signed uses a green lock. Both animations stop when reduced motion is
requested. Stage text has no added indent, and right-side amounts stay aligned.
Lead rows explicitly left-align names and companies. An audit of the active `won`
rows found existing client follow-up and invoice records; these are omitted
from Lead MRR but are not deleted or moved. No records are changed.

Offers dashboard (2026-11-07): four separate offer statistic cards are now one
expandable card. The closed card shows offers sent for the selected period and
awaiting replies. Expanding it shows awaiting, sent, accepted, and rejected
counts, period comparisons, and the existing sent/accepted goal bars.

Dashboard GA4 fallback (2026-11-07): when a brand has a GA4 property ID but
this server lacks service-account credentials, skip the API calls and show
Website as unavailable instead of logging an error that triggers Next.js's
development overlay. Provider failures also show unavailable and log a warning.
See `docs/sop-dashboard-analytics.md`.

Lead MRR qualification correction (2026-11-07): the dashboard now excludes cold `prospect` stage items from Lead MRR. They remain in the CRM prospects pipeline and do not count as qualified sales leads. Existing `lost` and `won` exclusions remain. Only a focused source edit was made; `git diff --check` passes. No tests, typecheck, commit, push, or deploy were run.

Goal bar gradient correction (2026-11-07): MRR and Lead MRR bars now keep the red-to-green gradient anchored across the full track. The neutral remainder covers the unearned portion, so increasing progress reveals the spectrum from red toward green instead of compressing all colors into the filled segment. Only the bar rendering changed; goal values and card layout are unchanged. `git diff --check` passes. No tests, typecheck, commit, push, or deploy were run.

YouTube dashboard fallback (2026-11-07): when the saved refresh token cannot be decrypted by this server, SWapp logs a warning rather than `console.error` (which raised the Next.js dev overlay) and shows YouTube data as unavailable instead of reporting no activity. No refresh token was changed and no database write or reconnect was attempted. `git diff --check` passes. No tests or typecheck were run.

Pipeline source-of-truth transition (2026-11-08): Tom directed that SWapp
become the working source for pipeline records, with Sales SQLite retained as a
migration source and later made read-only after parity. Current fields,
existing SWapp controls, missing value/payment/agreement data, and cutover gates
are mapped in `docs/pipeline-source-of-truth.md`. Existing app controls include
stage moves, next-action/due-date/value edits, and archive/restore. A new
brand-scoped form creates an unpriced opportunity and links a matching Contact
by email or phone (creating a Contact when needed). It does not add to MRR or
forecast totals. Valued opportunity creation remains gated: `MeetingLead.amountKind`
currently means `offer` or `invoice`, while the dashboard amount field does not
carry an explicit monthly/one-time basis. Board action `e2a280b4269b` awaits
Kassad's review of Sales workflows and the write boundary. No schema, Sales
sync, SQLite records, or shared Supabase rows were changed. `npm run typecheck`
and `git diff --check` pass. `npm run lint` exits 0 with 9 warnings. `npm test`
passes 125 test files / 982 tests, with 1 test file and 5 tests skipped.

Merge preparation (2026-11-08): updated the A/R aging test expectation to
include the four aging buckets. Typecheck, lint, and tests pass. The dashboard
goal SQL migration `20261107160000_dashboard_mrr_goals` remains unapplied; the
app detects missing columns and disables saved goal settings. No production
database change was made. Local `next build` was not run; CI's required checks
are typecheck, lint, and unit tests.
