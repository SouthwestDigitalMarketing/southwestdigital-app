# SWapp handoff

## 2026-11-13 — TREB new-video preview (Ummon Codex)

- Branch `ummon/treb-new-video-entry` from current `origin/main`; local dev server on ripley `100.98.89.93:3001` remains running. Ripley `treb-dev-proxy.service` serves branded preview `http://100.98.89.93:3011/login`, forwarding to `:3001` with Host `app.realestatebookkeeper.com`. Dalliance fetch returned HTTP 200 and the TREB sign-in heading. Tom signed in and reached `/youtube` in the correct brand.
- YouTube page previously returned only an analytics connection prompt. Added a `Make a new video` entry before the analytics branch and `/youtube/new` source choice: phone, Canon C100 SD card, already on ripley. Phone choice links to current tailnet phone inbox `:8931`; this is a working stopgap, not the final authenticated transfer. `npm run typecheck` passed. Desktop visual review of the new screen is pending.
- Do not ask Tom to connect YouTube before asset ingest. Integration from SWapp upload receipt into Showrunner project folder and mode remains unbuilt. The project folder `~/Videos/showrunner-projects/TREB 261113 New Video` exists, but no media has been copied into it. Johnny/Severn board action notices `a3369a650eed` / `16688b07581f` seek agreement on the shared Showrunner contract before touching that repo.
- 2026-11-13 layout follow-up: Tom asked the new-video page to fill the main area like the other SWapp pages. The All Thing had no SWapp design page, so `concepts/swapp-design-guidelines.md` was added first (All Thing commit `d481c6d`): full-width outer page, desktop `p-8`, responsive inner grids. `/youtube/new` now follows that rule (`p-8`, source cards in 3 columns on large screens). All Thing lint reported 111 existing issues; none named the new page or its parent.
- 2026-11-13 analytics correction: Tom expects the existing YouTube analytics and Connect control on the same `/youtube` page. The new-video card pushed that control down; moved the analytics heading/status above it. Ripley dev DB has TREB channel ID `UCK8UR3T14CPAH-XeX_eBTKA` and an ACTIVE integration with ciphertext, but local `AUTH_SECRET` cannot decrypt it; there is no local `INTEGRATION_ENCRYPTION_KEY` or `YOUTUBE_REFRESH_TOKEN_TREB`. A Vercel production env pull did not yield a key that decrypts it (temp pull file removed). Therefore local preview cannot show analytics; the page now says that plainly instead of claiming the brand is unconnected. Never call this a complete analytics restore until the dev server has a working token. The local `/api/youtube/connect` also lacks `YOUTUBE_OAUTH_CLIENT_ID`, so do not ask Tom to click it as a repair.
- Tom settled the entry pattern: the eventual merge has one **Create new video** button at the top of `/youtube`; it opens a separate page for the multi-step setup. The previous large card is removed. Analytics stays below the button. The first page currently asks where footage lives; transfer and Showrunner launch remain to build.

## 2026-11-12 — Ummon (Grok, Scanner w2W): log-only page, tables applied

Branch `scanner/findings` in `~/projects/worktrees/swapp-scanner`, cut from
`origin/main` `2099313`. Tom said ship a usable version now. No timer. Nothing
is sent to a client.

Applied on the configured Supabase database (direct port 5432, `prisma db
execute`, not migrate):

- `ScanRole` and `ScanFinding`, forced brand row-level security. Read-back:
  4 roles (Mail desk Donna, Sales pipeline Kassad, Client delivery Tom,
  Systems unset) and both tables `relforcerowsecurity = true`.
- 9 open findings, posted once from this session, not by a timer. Inbox:
  spam review 2 waiting, newsletter review 70 waiting (`bin/scan status`).
  Contracts: 6 `SENT_TO_CLIENT` proposals (Rodan Properties LLC, SJ Equity
  LLC, Hydraulics Technology, Inc., two BBQ Grill People LLC, US Promoline)
  and 1 `SIGNED` row with `CANCELLATION_REQUESTED` (client name Bookkeeping
  Conroe, signed 2026-09-04). Same database the app already uses, so the
  rows are there before the page code deploys.

Code:

- `/scanner` — "Needs you now", by room, and what closed. Sidebar item and
  keyboard `g n`. Log only.
- `POST /api/scanner/findings` — off until `SCANNER_API_TOKEN_SHA256` and
  `SCANNER_API_ACTOR_USER_ID` are set. Bookkeeping Conroe only. A repeat key
  updates the same row. `presence: "gone"` closes it. Unknown fields are
  rejected. Nothing is sent or fixed.

Browser on `127.0.0.1:3012` (webpack, dev bypass, Bookkeeping Conroe):
sidebar Scanner is the current page, `/scanner` shows Needs you now (9),
`?role=mail-desk` shows 2 and keeps Mail desk selected, `?role=sales-pipeline`
shows 7. `npx prisma generate` wrote the client into the shared
`southwestdigital-app/node_modules`. This worktree's `node_modules` is a
symlink there.

Donna, Kassad, and Severn were told on the board (messages `e3e6f3f82852`,
`56670e753c67`, `c82faf76fa7d`) and have not answered. Their Foremen are not
registered, so the pings stayed on the board. The shell shipped without
their lists. No standing timer. Board now: `9f4d2ffddc85`.

Checks on ripley, 2026-11-12: `tsc --noEmit` passed. `vitest run` 1032
passed, 5 skipped. ESLint on the new Scanner files and `commands.ts` is
clean. `AppShell.tsx` still has the old `no-img-element` warning at line
289, not from this slice. `npx next build --webpack` compiled, type-checked,
and generated 54 pages, including `/scanner` and `/api/scanner/findings`.
The dev server on port 3012 was stopped after the browser check.

## 2026-11-10 night — Ummon (Claude, tab w2N): proposal ACH

- Merged PR #98 (`b3d6ffd`, Vercel success): proposal checkout offers `us_bank_account` beside card (`src/lib/stripe/paymentIntentParams.ts`); card-only retry with idempotency suffix `:card` if Stripe rejects ACH; a `processing` intent returns `{processing: true}` and both proposal views show "processing"; deposit marked paid only on `payment_intent.succeeded`; `payment_intent.payment_failed` is logged only (deposit stays unpaid, client can retry).
- Stripe: destination charges without `on_behalf_of` use the PLATFORM payment method config (Stripe docs, connect/account-capabilities). Tom was turning on ACH Direct Debit in Dashboard > Settings > Payments > Payment methods > "For your platform account" > Default (`pmc_1SAgma2R5qsZ6eIFjm0IzL1j`) at wrapup; NOT confirmed. Amex not verified. Dashboard also shows a "negative balance" alert (unrelated).
- Checks: typecheck pass; lint 0 errors; vitest 1017 passed, 5 skipped.
- Worktree quirk: Turbopack `next build` fails here (node_modules is a symlink out of the root). `npx next build --webpack` compiles and type-checks; it then fails locally on missing `PLATFORM_BASE_URL` (env only).
- Next: (1) confirm ACH on — an unpaid proposal's payment step should show "US bank account"; (2) Donna's board ask ac7603c57e93: notify Tom when a deposit is paid (and on ACH failure) — not started; Stripe webhook endpoint may need `payment_intent.payment_failed` subscribed.

## 2026-11-10 — Kassad: client proposal UX (Dan Ruiz offer)

- Merged to main (PRs #79–#90, #94): proposal pricing step uses package tabs (with prices) + one swipeable card + fixed checkout bar (slim tabs, due today, Select) at **every** screen size; billing two-tab control; light section labels; package colors (Grow #D4A017 / Improve brandDark / Maintain #0F766E); full inclusion lists (support level first, then new, then carried) with the time promise inline; cover video shows a thumbnail while the player loads; `?internal=1` marks a browser as internal (cookie `swapp_internal_viewer`) so it never records views/activity.
- Reverted (#93): 16px desktop type scale (#91/#92). Work parked on origin branch `kassad/parked-proposal-type-scale` (60122f3) — Tom wants to revisit after the Dan proposal.
- Production is **Vercel** (project `lochside-llc/swapp`), not Netlify; check the PR "Vercel" status and `vercel env ls production`.
- Checks each PR: `tsc --noEmit`, eslint (0 errors; 1 pre-existing no-img-element warning), `vitest run` (1007–1010 passed, 5 skipped), GitHub typecheck/lint/test. Live verification via Playwright with `/api/proposal/track` aborted.
- Open: payment checkout not tested end to end recently; Standard Client Support tooltip says 1–2 business days vs 2–3 in `SERVICE_LEVEL_COPY`; offer builder Email step builds links on the admin host (proposal route is brand-host only).

## 2026-11-08 automation work in progress

Branch `feat/automation-event-foundation` was created from `origin/main`
`c9dd2ab`. Tom directed an event-driven sales process that updates both SWapp
and the All Thing without re-entry. The implementation boundary is in
`docs/sales-automation.md`.

Read-back of the configured Supabase database found **7** active Bookkeeping
Conroe `MeetingLead` rows named Dagny Yznaga, company Contigo Accounting,
with pipe IDs `10`, `11`, `12`, `59`, `8264`, `8345`, `8347`. All 7 were archived
with `isActive=false` in one transaction; read-back found **0** active Dagny
lead rows for Bookkeeping Conroe. No Contigo brand rows were changed. Those
records remain restorable. The legacy Sales SQLite copy was not changed.

The additive `20261108165000_sales_evidence_outbox` SQL was applied through
`prisma db execute` to the configured Supabase database; read-back found both
`SalesEvidenceEvent` and `AllThingWriteJob`. Pipeline lead creation and stage
moves now record an idempotent source event and its All Thing job in the same
PostgreSQL transaction. Settings shows the pending/failed job count by brand.
The All Thing writer script is drafted but not enabled. Channel collectors,
stage evidence rules, and daily reconciliation are **not yet implemented**.
A board action notice
`a2c1ef9c96fb` requests coordination before shared All Thing hub/index edits;
`hubs/sales.md`, `hubs/leads.md`, and `sops/sop-lead-file.md` now exist in
the shared All Thing tree. The writer has been adapted to that layout, but
the shared write contract is awaiting Kassad and Severn's board response.
No new source event was generated by the Dagny cleanup.

The branch now also contains `scripts/process-all-thing-sales-jobs.mjs`, a
manually run writer for lead diary pages, and authenticated
`POST /api/pipe/evidence` for attaching a source event to an existing active
lead. The script now requires `hubs/leads.md` and the lead-file SOP; it
refuses to write without them. No All Thing page was changed yet.
The endpoint does not yet create leads or advance stages. The writer completed
one proof against the All Thing; no timer has been installed.

`scripts/collect-quo-call-evidence.mjs` now reads the existing Quo call cache
read-only and resolves a completed call only when its brand line, contact
phone, and active linked SWapp lead are unique. The `--days=7` dry run on
2026-11-08 scanned 13 completed calls: 1 matched, 5 ambiguous, 7 unmatched,
0 invalid. On the next turn `--apply --days=7` recorded only Quo call #549
as event `cmw852hjd0000jja49ii0uw0e`, linked to Kevin
(`cmvzrwakr0003ju08u500z3kb`). Its All Thing job
`cmw852hql0002jja4oeagbt0x` was initially pending. A repeated apply
reported 1 already recorded and created no duplicate. Kevin remains in
stage `lead`; the adapter does not move stages. No timer is installed.

Writer update: the All Thing now has a lead-file SOP and `hubs/leads.md`.
The worker follows its two-page layout and matches an existing page by
`swapp_deal_id`. It was run once after Kassad's approval on notice
`486e99f80bed`; Severn notice `d7a72c3d63af` remains pending. Quo call #549
was a 35-second outgoing call to Kevin; SWapp says his full name, company and
needs remain unknown. No stage should move from that call alone. The All
Thing lint baseline fails with 78 unrelated issues, so the worker checks
that its write does not increase the count. This is not a clean lint pass.

Kassad confirmed the shared lead-file contract on board notice
`486e99f80bed`. The Quo #549 worker proof wrote
`leads/kevin/kevin.md`, `leads/kevin/kevin-diary.md`, the leads hub line,
index links, and log. All Thing commit `0f2820a` was pushed to main;
`bcedbe3` corrected a duplicated period in the generated next action.
The first worker run hit a shadowed `process` identifier before writing;
the next run wrote and pushed, then hit an out-of-scope `marker` variable
before marking the job done. Both code errors were fixed. The retry found
the marker and marked job `cmw852hql0002jja4oeagbt0x` done, attempts 1,
lastError null. Read-back found exactly one diary entry, source call #549,
and Kevin still at stage `lead`. The All Thing lint still reports 78 issues
(same as before). Severn's board notice `d7a72c3d63af` has not been
answered yet; no conflicting shared edit was observed.

Checks for the writer update: `node --check` on both scripts,
`git diff --check`, `npm run typecheck`, `npm run lint -- --quiet`, and
`npm test` passed (982 passed, 5 skipped). No timer, merge, or production
deploy yet.

Checks on this branch: Prisma schema validation and client generation passed;
`npm run typecheck`, `npm run lint -- --quiet`, `git diff --check`, and `npm test`
passed after adjusting the existing stage-move transaction tests. Vitest:
982 passed, 5 skipped. No signed-in phone check or production deployment has
been done for this branch.

Checked on **ripley**, 2026-11-08 (America/Chicago), by Ummon.
`README.md` describes the project; this file records the current branch and
work. Prior handoff notes are archived at
`docs/handoff-archive/2026-11-05-before-mobile-ux-preview.md`.

## Current state

- Branch base: `origin/main` commit
  `9a9188c6243558b5ae7d568b7803a5257e08cb62`. Current branch:
  `feat/swapp-own-pipeline-cutover`. This branch contains the pipeline
  source-of-truth cutover and current lead-detail/dashboard updates.
- The phone-preview configuration in `next.config.ts` and `src/auth.ts` is
  already part of the merged main branch; no pre-existing local code changes
  were present at the start of this follow-up.
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
- The current data source and cutover rules are in
  `docs/pipeline-source-of-truth.md`. The pipeline schema migration
  `prisma/migrations/20261108180000_pipeline_opportunity_terms/migration.sql`
  was applied with `prisma db execute`. The four new columns were read back.
  The same migration run classified 51 matching Bookkeeping Conroe leads:
  47 monthly and 4 one-time. All 51 were matched by SWapp record ID, with no
  stage mismatches. The 2 local-only records were left unchanged. Their current
  values were preserved: 10 monthly leads with values total `$7,300`; 1
  one-time lead with a value of `$750`. The earlier `$8,050` combined total is
  now split by basis.
- `npm run typecheck` and `git diff --check` pass. The dashboard endpoint responds with HTTP 307 to `/login` without a session. No test suite or signed-in phone visual check was run after the latest card change; Tom's screenshot showed the all-pipeline selector took too much space, so the selector was replaced with one Lead MRR dropdown.
- Added monthly MRR and Lead MRR goal fields to Settings and progress bars at the bottom of the two existing cards. The migration `prisma/migrations/20261107160000_dashboard_mrr_goals/migration.sql` was applied to the configured Supabase database on 2026-11-08 using `prisma db execute`, following `docs/deployment/database-migration-state.md`. Read-back confirmed both columns exist and the Bookkeeping Conroe brand row has `monthlyMrrGoal=10000` and `leadMrrGoal=10000`. No other brand row was updated. Platform brand administration selects only the theme fields it uses.
- The `/settings` side-menu item uses normal Next client navigation. The mobile drawer now closes after the pathname changes. A direct full-page load was tried and caused `net::ERR_CONNECTION_ABORTED` on the phone, so it was reverted. Ripley responds locally at port 3001; the signed-in phone route is not yet verified.

## Preview

Tom can refresh the MRR and pipeline dashboard on his phone at
`http://100.98.89.93:3001/dashboard`. Tailscale must be connected and the user
must be signed in. The user timer is enabled on Ripley and uses
`/home/tom/projects/bookbot-invoice-history/bin/qb`; keep that worktree
available while this preview setup is in use.

The dashboard has a separate Pipelines section below Revenue, with monthly and one-time forecast cards. Expanding either shows Pipe Prospects stage totals in that card's value basis; expanding a stage lists leads and links to the brand-scoped `/leads/[id]` page. Totals are unweighted.

Lead MRR displays five action stages: Ask lead to invite us to QBO, Review QBO, Present to decision maker, Collect initial payment, and Get service agreements signed. It excludes `won` and `lost` plus cold `prospect` stage items. One-time work is shown separately and never counted as MRR. Lead records now store explicit offer type, value basis, first-payment date, and agreement date.

Both MRR cards place the Detail link below the progress bar when expanded. Revenue and pipeline detail pages use the shared `HistoryBackLink`, which returns through browser history to restore the page and scroll position; direct visits fall back to `/dashboard` or `/pipeline` respectively.

The old Sales SQLite sync can still pull changes from SWapp into its local report copy. Deal uploads from SQLite to SWapp are disabled. SWapp matches these records by saved record ID before checking the older `pipeId`, so mismatched legacy deal numbers do not create duplicates.
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

Pipeline source-of-truth transition (2026-11-08): SWapp now owns working
pipeline records. The additive schema was applied and 51 source records were
backfilled in place. Sales deal uploads were disabled; pulls now match by the
SWapp record ID first and accept SWapp changes as authoritative. Sales code is
in `/home/tom/projects/sales-swapp-pipeline-cutover` on
`feat/swapp-pipeline-cutover`; no client data or SQLite records were changed.
SWapp typecheck, lint, and unit tests passed in PR CI run `42439060137`; lint
has 9 warnings and 0 errors. The first run found one stale lead-step assertion,
which was updated. The local production build also passed with Webpack and a
temporary local `PLATFORM_BASE_URL`. Netlify initially failed because `AUTH_URL`
was set while `src/auth.ts` requires it and `NEXTAUTH_URL` to stay unset for
multi-hostname sign-in. I removed `AUTH_URL` from the site's deploy-preview and
production contexts and confirmed it is unset in both. Netlify's preview and
production deploys are now `ready` for commits `6e57e3d` and `eda363e`; Vercel
production is successful. PR #75 merged as `eda363e`; post-merge CI run
`42439198903` passed typecheck, lint, and unit tests.

Sales PR #73 merged as `a59f9b1`. Sales `compileall` and `git diff --check`
passed; no unit tests ran and no CI checks are configured. Ripley's active Sales
CLI runs from local branch `ummon/sales-live-cutover`, which merges the updated
Sales `origin/main` into the preserved local Quo branch so the legacy deal
writer is disabled without discarding its four local commits or untracked
`docs/`. This runtime branch is not pushed because it contains that unpublished
Quo work. The minute `sales-sync.timer` runs `sales --local sync all` for Quo
messages, calls, and contacts; it does not sync pipeline deals. The Sales PR's
remote branch and temporary worktree were removed.

Phone preview port `3001` is listening on `100.98.89.93` and redirects to
`/login`; signed-in phone review has not been done.

The checked-out repo was clean at `origin/main` commit
`9a9188c6243558b5ae7d568b7803a5257e08cb62` before this follow-up. Current
topic branch: `feat/swapp-own-pipeline-cutover`. The dev server's current
health must be checked before handoff. The Sales repo change is source code only;
its SQLite database was read-only and had 51 canonical Bookkeeping Conroe
records plus 52 duplicate rows pointing at those same deals. The full source
inventory and migration gates are in
`docs/pipeline-source-of-truth.md`.

## 2026-11-09 afternoon (muse, Ummon tab) — tag-driven funnel + Potts verification
- Merged `feat/automation-event-foundation` (Quo collector, outbox, diary worker + brand guard) and `feat/tag-driven-funnel` (remove-tag mirror, automation coverage migration, kind-follows-tags, drift script, lead-page Tags section) into `main`. Branches pushed, merged, pruned remote+local.
- Coverage migration applied live via `prisma db execute` (never `migrate deploy`): 15 automation rules verified, step tags unified to LEAD.
- Gates at merge time: typecheck clean, eslint clean, 1004 passed / 5 skipped / 0 failed.
- Derek Potts / SJ Equity proposal verified safe (tiers 1250/1460/1875, onboarding $0, $800 credit, due now 450/660/1075; engagement SENT_TO_CLIENT fee WAIVED; Stripe ACTIVE). Created missing `proposal_view_events` table live. Link unchanged, no client contact.
- Pulled `origin/main` (#77, #78) after the merges; tree clean and in sync.
- Open: tag phase 2 backfill (drift backlog), Quo timer plan (presented, no go), 4 tag-build follow-ups, 128-vs-45 prospect reconciliation. Preview dev on `100.98.89.93:3001` still running from this checkout.

## 2026-11-10 evening (Claude, Ummon tab w2N) — git cleanup
- Repo pruned on Tom's ask: PR #95 merged (`207ad5f`). Worktrees: `southwestdigital-app` (detached at origin/main) and `southwestdigital-app-mobile-ux` (`main`). Remote branches: `main` + `kassad/parked-proposal-type-scale` (Kassad's, kept). `worktrees/swapp-dev` removed: its edits were on main already or marked LOCAL ONLY. Saved patches: `ripley:~/projects/patches/swapp-*.patch`.
- Open for Tom to pick: deal #53 next step (due 2026-11-10 17:00 CT, passed); SJ Equity pay/agreement check (board 1c82670abb4d, no reply yet); preview should load the saved offer snapshot (patch `swapp-dev-uncommitted-2026-10-27.patch` has a local prototype in `offer-preview/page.tsx`); `/api/pipe/offers` PATCH lacks contactInfo/suppressPromotions, duplicate copies source contact/credit. Prod DB read-only incident 68ab28d82e39 is Donna's.
