# SWapp handoff

## 2026-11-20 — One privacy switch for the whole app (Ummon)

Tom: "make the privacy button one switch for the whole app". `PrivacyToggle` now lives in the
shell: phone header (icon while off, "Privacy on" pill while on) and the desktop sidebar's
profile row (icon-only when collapsed). The layout reads cookie `swapp_privacy` and passes
`privacy` to `AppShell`. Pages listed in `PRIVACY_COVERED_PATHS` (`src/lib/privacy`) hide names
themselves (today `/scorecard`, `/reports`); every other page is blurred (`inert`, `blur-xl`)
under a "Privacy is on" card with a "Turn privacy off" button. To cover a page: hide names
server-side, then add its path. Toggling reloads the page (no stale RSC payload). `/reports`
adds `privacy=1|0` to the signed ripley link; ripley applying it to its own cookie is a
separate phone_intake.py change (see below / next entry). Checked locally with Playwright.

## 2026-11-20 — Agreement viewer (Reports-style), DRAFT stamp, test-proposal filter (Ummon)

Tom: drafts must carry a DRAFT watermark; a way to download; a Refresh for updated drafts, like the
Double reports viewer.
- ripley `scripts/phone_intake.py`: `REPORT_VIEWER` reused (CFG `back`/`backSigned`/`noun`/`dl`).
  `/agreements/<folder>/<doc>/view` and `/stat`, where doc is `gsa/draft|signed` (always the newest
  GSA file) or a file path. Back = `?ret=` (https only, from SWapp) else the client's list. Download
  adds `&dl=1` (attachment). List rows open the viewer.
- Any agreement PDF without SIGNED in its name is served DRAFT-stamped (qpdf `--overlay` of a
  generated one-page mark, cached in `~/.cache/swapp-phone-intake/drafts` by path+size+mtime;
  filename `..._DRAFT.pdf`). The client-folder file is never changed. Stamp failure -> 500, never
  the clean file.
- SWapp: GSA panel View -> `/agreements/pdfs?doc=...&ret=/leads/<id>#gsa` -> viewer. Strip and
  panels skip proposals whose contact email is at example.com/.net/.org (old "Automated Proposal
  Test", $1, 2026-09-04, had no isTestProposal flag).
- Checks: self-test ok (stamp present after qpdf --qdf, folder copy unchanged, dl attachment, viewer
  CFG, ret rejects javascript:, stat); tsc, lint 0 errors, vitest; installed on ripley, live: SJ
  Equity draft download 148,749 bytes, 13 pages, stamped; Rodan signed served clean; viewer at 412px
  renders 13 stamped pages, Back/Refresh/Download in one row.
- Incident while checking the test proposal (mine): `set default_transaction_read_only=on` through
  the 6543 pooler made prod writes fail 14:37-14:46 CST. Reset, verified; rule 6 in
  `docs/deployment/database-migrations.md`, All Thing troubleshooting row 2da77ff.
- Also: the main checkout's `node_modules` was found empty at 14:33 (likely after removing a
  worktree whose node_modules was a `cp -al` hard-link copy); restored with `npm ci`. Use `npm ci`
  in worktrees, not hard links.
## 2026-11-20 — Billing calendar: double-tap to today, past days grayed (#194, shipped)

`BillingCalendarStrip.tsx`: double-tap (touch, counted in `onPointerUp`) or
double-click smooth-scrolls back to yesterday at the left edge;
`touch-action: manipulation` on the row. Days before today are
`opacity-40 grayscale`. Not tested on a real phone by the agent.

## 2026-11-20 — GSA panel: View the draft / signed GSA (Ummon)

Tom: where it says Drafted, one tap should open the draft. GSA panel rows Drafted and Signed (once
marked) have a View button -> `/agreements/pdfs?folder=...&doc=draft|signed` (staff login, signed
link) -> ripley `scripts/phone_intake.py` `/agreements/<folder>/gsa/draft|signed`: the newest
`*General-Services-Agreement*` PDF in the client's agreements folder, unsigned or SIGNED. Folder
lookup with `?alt=` now applies to every `/agreements/<folder>/...` address, not only the list.
Checks: self-test ok (draft, signed, wrong folder via alt, 404 none, bad sig); tsc + eslint clean;
installed on ripley and restarted; live: SJ Equity draft (143,843 bytes, 13 pages), Rodan signed
(807,469 bytes), SJ Equity signed -> 404 "No signed GSA saved..."; local 412px screenshot of the panel
and the redirect target checked. Needs Tailscale, like all ripley PDFs.
## 2026-11-20 — Billing calendar day strip (#191, shipped)

Replaces the #188 countdown cards on the Bookkeeping Conroe dashboard with a
swipeable day strip (`BillingCalendarStrip.tsx`): 30 days back to 60 ahead,
opens at yesterday, 10 visible on phones / 14 at `sm` / 21 at `lg`, faded
edges. Payday green, reminders (last day - 3) blue, late fees (8th) red,
1st-7th shaded, today ringed; days-until above each upcoming colored day;
legend in a `Modal` behind `?`. `billingTimers()` removed;
`billingCalendarDays()` remains. Added dark/system `.text-blue-700` mapping in
`globals.css`. Dark mode not checked inside the signed-in app.

## 2026-11-20 — GSA alarm: paid proposal agreement, GSA not signed (Ummon)

Tom: until the proposal agreement is paid AND the GSA is signed they are a lead; paid-no-GSA is the
hottest lead and must be surfaced (terms: All Thing `sops/sop-quote-and-contract.md` § Words we use).
- Migration `20261120195824_engagement_gsa_progress` (additive): `Engagement.gsaDraftedAt`,
  `gsaSentAt`, `gsaSignedAt`, `gsaClientFolder`. Logic `src/lib/gsa/progress.ts` (pure, tested) and
  `store.ts`: paid = `onboardingFeeStatus PAID`, agreement ACTIVE/CANCELLATION_REQUESTED, not a test proposal.
- Dashboard: `GsaAlarm` strip at the top, only when any; amber, red once a payment is 24h+ old
  (SOP promises the GSA within 24h). Rows link to the lead (via LeadContact) else the contact, `#gsa`.
- `GsaPanel` on `/leads/[id]` and `/contacts/[id]`: tier, amount, paid date, next action, Drafted /
  Sent / Signed with Mark done / Undo (server action `src/app/(app)/gsa/actions.ts`), link to the
  ripley PDFs (`/agreements/pdfs?folder=...`, tries saved folder, company slug, slug without LLC).
- `GET/POST /api/operations/gsa` for agents (docs/operations-api.md). Signed also fills the leads'
  empty serviceAgreementSignedAt / firstPaymentReceivedAt. Undo does not clear those.
- NOT changed: payment still runs onClientWon (deal Won, Operations onboarding). Tom's idea 3
  (Won only after the GSA) needs Kassad first. Idea 4 (pre-fill Exhibit A from the proposal) not started.
- Checks: tsc clean; lint 0 errors; vitest 1208 pass (5 new); local dev at 412px and 1280px
  (0 overflow): two paid test proposals (30h red, 5h amber), Mark Drafted/Signed from the panel,
  signed one left the strip; API GET/POST/400/401 checked. Local test rows reset afterwards.
- After deploy: mark Rodan's GSA signed (its signed PDF is in `rodan-properties/agreements`) so only
  SJ Equity shows.
## 2026-11-20 — Dashboard billing countdowns (#188, shipped)

Top of the Bookkeeping Conroe dashboard only (`BILLING_TIMERS_BRAND_SLUG`):
Payday (next 1st), Invoice reminders go out (last day of month minus 3),
Late fees applied (runs the 1st-7th, lands on the 8th; otherwise "Starts in
N days"). Firm-local days via `firmDateKey`; logic and tests in
`src/lib/dashboard/billing-timers.ts`. Display only: the reminder email and
late-fee charging are not built (Tom: email content to be settled later).
Dark mode not checked inside the signed-in app.

## 2026-11-20 — Agreements page usable on a phone (Ummon)

Tom (phone screenshot): `/agreements` was barely usable at phone width (warning squeezed into a
column, totals cramped, table cut off on the right). Below `md`: PDF card is one tappable row with a
chevron; New agreement / Templates side by side; warning full width; totals as three tiles
(`max-md:` classes, because `[data-theme] .bg-white` overrides a plain `md:bg-transparent`); the
table is replaced by one card per agreement (client, status pill, issued/signed/payment, the same
row actions via `rowActions()`). Desktop table unchanged. Checks: eslint + tsc clean; local dev
(port 3017, local DB, dev-bypass login; needed `AUTH_SECRET` and `PLATFORM_BASE_URL=http://localhost:3017`
in the env, and a hard-linked `node_modules` copy, since Turbopack refuses a symlink out of the
worktree) screenshot at 412px: 0px horizontal overflow; 1280px: desktop table as before.

## 2026-11-20 — Agreements menu page opens every client's agreement PDFs (Ummon)

The client-record button (PR #185) sits on SWapp *ticket clients* (bc_next, Test Client...), which are
not the real clients, so SJ Equity had no way in. `/agreements` (menu item) now has a "Client agreement
PDFs" card at the top -> `/agreements/pdfs` (staff login, signs a link) -> ripley's tailnet
`/agreements` index in `scripts/phone_intake.py`: every client folder under `~/projects/clients` with
PDFs in `agreements/[v<N>/]`, "N signed" / "N unsigned" tags, clients with unsigned first. Rows open the
per-client list from #185. Nothing stored in SWapp; phone needs Tailscale. Folders starting with `_`
and clients without PDFs are not listed. Checks: `phone_intake.py --self-test` ok (index added),
vitest `src/lib/phone-intake` 6 pass, `tsc` clean; installed on ripley and restarted; screenshot of the
index at 412px wide read fine. Not checked: the SWapp card/redirect on a real phone (needs login).
"Unsigned" is any PDF without SIGNED in its name, so old drafts count as unsigned.

## 2026-11-20 — Agreement PDFs on the client record (Ummon)

Client record (`/clients/[id]`) has an "Agreements (PDFs)" button -> `/clients/[id]/agreements`
(staff login, brand-checked) signs a link and redirects to ripley's tailnet
`/agreements/<name-slug>?alt=<client code>` in `scripts/phone_intake.py`. Ripley lists
`~/projects/clients/<client>/agreements/[v<N>/]*.pdf` (SIGNED in the file name = Signed) and
opens each inline; same signed-session link as Reports. SWapp stores nothing (Tom, 2026-11-20: keep
the PDFs in the client folders on ripley). Needs the phone on Tailscale, like Reports.
Checks: `phone_intake.py --self-test` ok (list, open, bad sig, traversal, non-PDF); vitest
`src/lib/phone-intake` 6 pass; `tsc --noEmit` clean. Live on ripley (installed copy restarted):
SJ Equity listing + PDF (143,843 bytes) fetched with a signed link. Not checked: the SWapp button
on a real phone (needs login; folder name comes from the client name slug, then the code).
Follow-up: client-name mismatch with the folder name shows "No agreements saved yet".
Privacy mode is not applied to this page.

## 2026-11-20 — Scorecard privacy mode (Ummon)

"Privacy off/on" button in the Scorecard header (`src/components/PrivacyToggle.tsx`, reusable
if privacy goes app-wide). Cookie `swapp_privacy=1` on the SWapp host (path `/`, 1 year;
ripley's Reports cookie is separate). The page reads it server-side and passes the data
through `privatizeScorecard` (`src/lib/scorecard/privacy.ts`): waiting-list and report-days
client names become `Client A…` (one letter per client on the page, assigned by order shown,
so letters are not stable across refreshes and do not match ripley's Reports aliases), and
sync failure notes are dropped. Turning privacy on does a full reload so the first load's RSC
payload with real names is gone. Checked locally on the fixture: visible text, embedded page
data and raw HTML have no real names; 390 px has no horizontal scroll. Charts and counts carry
no names.

## 2026-11-20 — Reports privacy mode (Ummon)

Header switch "Privacy off/on" on every ripley Reports page (`scripts/phone_intake.py`),
for screen recordings. Cookie `swapp_privacy=1` (path `/reports`); other open tabs follow
within 2 s. When on, the server writes aliases (`Client A`, fixed per client in
`~/.local/share/swapp-phone-intake/privacy-aliases.json`), alias links (`/reports/client-a`;
real-folder URLs 302 to the alias), `Account N` for account names, hides notes, free-text
waiting reasons, feed notes and Download. The viewer blacks out, before a page is shown:
client-name words (FNV hashes, never the name; extras per client in
`~/.config/swapp-phone-intake/privacy-words.json`, seeded 2026-11-20 with owner names from
SWapp contacts), whole lines with account-shaped numbers or "(deleted)", emails, phones,
EIN/SSN, long digit runs, street addresses/PO Box/FM roads, names after Distributions/Draw/Owner
dashes, numbered-list names (top payees), capitalised possessives. Adversarial review x2 over
the 7 clients' latest reports. Known gaps: images (logos) are not scanned; a last-4 between
1900 and 2099 alone at a line end is treated as a year; people's names elsewhere in free
text need `privacy-words.json`.

## 2026-11-20 — Scorecard (Ummon, built by an agent team)

`/scorecard` (sidebar after Operations): how fast we answer clients. Spec
`docs/scorecard.md`, API `docs/scorecard-api.md`, collector
`docs/scorecard-collector.md`, contract `src/lib/scorecard/types.ts`.
Tables `ScorecardEvent`, `ScorecardSync` (migration `20261120124026_scorecard`).
Ripley collector `scripts/scorecard_collect.py` (stdlib Python; Quo
`sales.db` read-only, Zoho headers read-only) posts to
`POST /api/scorecard/ingest` with the Operations token; timer
`swapp-scorecard.timer` every 5 min (unit files in `scripts/systemd/`).
Clients = contacts with a `ServiceRecord`, inside their record window.
Business hours Mon–Fri 8–5 Central (`src/lib/scorecard/hours.ts`).
Known limits: report delivery has no trustworthy history before Operations
evidence (tracking 2026-11-19; PDF mtimes are save dates, Double API has no
publish time); voicemail count reads 0 (every no-answer call in `sales.db` has
`duration=0`); weekly phone-chart medians are count-weighted daily medians.
Built with the Workflow tool: 3 builders in worktrees, adversarial reviewer
per builder (core 1 round, collector 2, ui 3). Process: All Thing
`sops/sop-agent-teams.md`.

## 2026-11-20 — Reports viewer that refreshes itself (Sol's brief, for Tom)

Month links on ripley's Reports page now open `/reports/<folder>/<year>/<YYYY-MM>/view`:
PDF.js (pdfjs-dist 3.11.174, `scripts/pdfjs/`, served at `/reports/_pdfjs/`, no CDN)
with a top bar (Back to client, Refresh, "Updated <file time, Chicago>", Download).
The page polls `.../stat` every 10 s (mtime + size) and re-renders in place, keeping
the reader's page and position, when Sol re-saves the PDF. A half-written file keeps
the old render and retries. `stat` hands back a fresh signed link when under 1 h is
left, so an open viewer outlives the 3 h TTL. The raw PDF path
(`/reports/<f>/<y>/<YYYY-MM>.pdf`) is unchanged (Download, `/reports.json` alerts).
Deploy: copy `phone_intake.py` and `pdfjs/` to `~/.local/share/swapp-phone-intake/`,
restart `swapp-phone-intake.service`. Not embedded: PDF.js standard fonts and cmaps
(Double PDFs embed their fonts; check if a report ever shows missing text).

## 2026-11-19 — Website traffic card phone layout (#175, shipped)

`/website` Daily Engaged Sessions card below `sm` (640 px) only; desktop
unchanged. Flat sparse x labels (Mondays at 30d, every day at 7d, 6/12 h
hourly, every Nth week), stacked header, legend on its own row, 90d shows 13
weekly bars (pace target = daily goal x days in bucket). Helpers and tests in
`src/app/(app)/website/traffic-chart-mobile.ts`. Tom approved the look on his
phone from a sample-data preview: no GA4 key locally
(`GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` is a Production-only Vercel secret), so
a real-data phone check happens on production.

## 2026-11-18/19 — Service records steps 3-5 done (shipped)

All Thing `concepts/service-records-design.md`, Tom's go via Kassad for each.

- **Step 3 rest** (#165, `7c71937`): records set tags (`serviceTagPlan`,
  `syncServiceTags`; after every record save, nightly `/api/cron/service-tags`
  06:15 UTC, `ops service-sync [--dry-run]`). Dashboard counts clients by
  `service-<product>-active` for a recurring product, fees from records;
  mismatches on the card and `/dashboard/revenue`. Funnel: step-less deals go
  by stage. Dashboard periods are Chicago days. Production sync: 7 contacts
  changed, rerun 0.
- **Step 4** (#167 `2370c80`, #168 `2ab091c`): client-won opens records from
  the paid proposal; opening balances done ends the onboarding record;
  `ops agreements-scan` opens records from `*SIGNED*.pdf` + builder JSON (no
  Intuit completion email exists in Zoho or Gmail); `ops service-check
  [--fix] [--save]` compares our QuickBooks billing (qb, read-only) with
  records, deals and tags. Timer `swapp-service-check.timer` on ripley
  (07:10 Chicago; unit files in `scripts/systemd/`), run once by hand: ok.
  First check: 1 item for Tom (Contigo billed $400 in Nov, no agreement),
  4 duplicate won deals for Kassad. Scan review entry is mailroom-app PR #82,
  waiting on Donna's ok (not merged).
- **Step 5** (#169 `b71378b`, #170 `c088352`): `Contact.mrrUsd` removed from
  screens/forms (contact page tile reads records), then dropped by migration
  `20261119040000_drop_contact_mrr_usd` (applied 03:46 UTC 11-19). Values
  before: ripley `~/backups/swapp-db/contact-mrrUsd-before-drop-20261118.csv`
  (3 rows, $750, all covered by records).
- Still open: Sales `pipe mrr` reads its own won-deal MRR ($1,050 incl.
  Contigo); point it at `ops services` (Kassad noted `~/projects/sales` sits on
  branch `ummon/sales-live-cutover`).

## 2026-11-18 — Dashboard MRR reads service records (shipped)

PR #162 merged as `563a4b2` (step 3 of `concepts/service-records-design.md`,
Tom's go). The MRR card and `/dashboard/revenue` use `getRecordMrr`
(`src/lib/operations/serviceRecordsMrr.ts`): agreed fees of monthly service
records active today (America/Chicago), per client; future-start monthly
records show as "signed, starting", not in the total. Production expectation
$1,230/mo, 4 clients (`ops services` agrees). Checked locally with phone-size
screenshots (local sign-in needs `AUTH_SECRET=localdevsecret-...` and the
saved cookie). `Contact.mrrUsd` was retired in step 5 (below). Not done from the design's dashboard list:
lead funnel step-1 default, Chicago date ranges.

## 2026-11-18 — Service records: table, loader, backfill (shipped)

Steps 2 of All Thing `concepts/service-records-design.md` (Tom's go via
Kassad, board 304efb48f94c). PR #158 (`33e9ad5`) added `ServiceRecord`;
production build applied `20261118233000_service_records` (log 02:09 UTC
11-19). PR #159 (`e5e6600`) added the loader.

- Design: Engagement stays the agreement; `ServiceRecord` is one paid service
  (contact required, engagement optional, basis monthly|one_time|hourly,
  fee, start/end + endReason, evidence source/ref/date, previousId for fee
  amendments, sourceKey for idempotent loads). DB CHECKs: monthly needs fee
  > 0 and non-invoice evidence; end date and reason together.
- Loader: `PUT/GET /api/operations/service-records`; `ops services`,
  `ops service-load FILE.json`. Docs: `docs/operations-api.md`.
- Backfill loaded to production 2026-11-19 ~02:20 UTC: 13 records, 0 failed;
  file kept at ripley `~/projects/clients/_service-records/loaded-2026-11-18.json`.
  `ops services`: MRR $1,230/mo, 4 clients (AAA 150, BnB 150, Bayou City 450,
  Rodan 480 from 2026-11-01 per its SOW; November paid in the deposit).
- Not loaded: Taylor-Martino, Scotty Williams, CleanCap (ended; no SWapp
  contact); Contigo, ARI, Samuel Yates (no agreement on file: GAP by rule).
- Not built (not approved): dashboard MRR from records (step 3), patrol
  mismatch check and QBO Contracts automation (step 4), retiring
  `Contact.mrrUsd` (step 5); `onClientWon` does not yet open a record.

## 2026-11-18 — Client won automation (shipped)

PR #156 merged as `6e191d4`. The production build applied migration
`20261118220000_client_won_records` (log 22:50 UTC): `Engagement.contactId`;
`OperationsClient.stage` (onboarding|active|former), `wonOn`, `engagementId`.

- A live paid proposal (Stripe webhook) runs `onClientWon`
  (`src/lib/operations/clientWon.ts`): service record filled, contact linked
  (by email, else created), client tags added (Reviews pipeline starts from
  `review-pending`), open Pipe Prospects deals to won and `lead` removed,
  Operations client in stage onboarding with a 6-step checklist
  (`onboarding-*` duties in `playbook.ts`). Result is posted as evidence on
  `onboarding-records`. Test payments (livemode false) skip it. Rerun by hand:
  `ops client-won <engagementId>`.
- Posting `done` on `onboarding-opening-balances` moves the client to active
  (recurring duties from the next day).
- `~/.local/bin/qb-clients` (ripley, not in a repo) asks
  `GET /api/operations/clients` first: onboarding = SETUP, active = ACTIVE,
  former = LOCKED; falls back to tags when SWapp is unreachable or the
  company is not on the roster. Verified after deploy with `qb-clients --json`.
- Rodan backfill (2026-11-18 22:51 UTC): all 5 steps done; read back from
  production: engagement MONTHLY_BOOKKEEPING / MONTHLY_RECURRING / 480,
  linked to contact `cmw9tyw5k0001l208zv48urd4`; tags now active-client,
  contract-signed, monthly-bookkeeping, paid, qb-work-setup, review-pending,
  service-monthly-bookkeeping-active (lead removed); Operations
  `rodan-properties-llc` onboarding, active, wonOn 2026-11-11; 2 pipe-prospects
  deals moved to won (leads `cmw9tz0jh0004l208m1jjujre` from 11-09 and
  `cmwdto8c6000hl308916nflph` from 11-12, likely a duplicate; Kassad told).
  Rodan's onboarding steps due 11-13/11-14 show overdue until Sol's agents
  post evidence.
- Checks: typecheck pass; lint 0 errors; vitest 1083 passed, 5 skipped;
  `next build` pass; CI pass. Local end-to-end against the Docker DB passed
  and a second run was idempotent.
- Known: Sales' local copy does not apply tag removals, so `lead` stays in
  `sales.db` (Kassad's decision, board `de02c2af7180`). An old `prospects`
  pipeline item for Rodan still sits at education-interest; not touched.

## 2026-11-18 — Operations evidence store (shipped)

PR #154 merged as `1ca192a`. The production build applied migration
`20261118203117_operations_evidence` (log 20:47 UTC): tables
`OperationsClient` and `OperationsEvidence`. `/operations` now shows real
states; a duty is green only with posted evidence, overdue after its due hour
without it. Tracking starts 2026-11-19 (`TRACKING_STARTS` in
`src/lib/operations/schedule.ts`). API and `ops` CLI: `docs/operations-api.md`.

- `OPERATIONS_API_TOKEN_SHA256` is set in Vercel Production. The token is on
  ripley in `~/.config/swapp/operations.env` (600); `~/.local/bin/ops` wraps
  `scripts/ops.mjs` from the main checkout (hops to ripley elsewhere).
- Roster: Tom enrolled 8 clients on 2026-11-18 (all Double clients except
  Bookkeeping Conroe), keys = `qb` slugs, `startsOn` 2026-11-19. Bayou City
  Horticulture has no `qb` company (not connected). Read back from
  production: 8 rows, all active.
- Checks: typecheck pass; lint 0 errors; vitest 1076 passed, 5 skipped;
  `next build` pass; CI (including migrations job) pass. Local end-to-end
  against the Docker DB: enroll, post, duplicate, refusals, 401.
- Board action notice `4cf0d7f0e2c2` asks Sol's agents to start posting on
  2026-11-19. Until they do, the page will show those duties overdue.
- Known: `scripts/seed-initial-brands.mjs` fails on the current schema
  (`Unknown argument primaryColor`); not fixed.

Next slices (Tom's order): single-client screen, Needs you actions, editable
or per-client playbook, then feeds (Double close progress, QBO, Zoho, Quo).

## 2026-11-18 — Prisma migrations baselined (shipped)

PR #152 merged as `00b8cd6`. SWapp now uses the standard Prisma workflow;
read `docs/deployment/database-migrations.md`. The old "never run migrate"
rule is superseded, and hand-applying SQL to production is now forbidden
(the deploy would apply it again).

- `prisma/migrations/0_init` recreates production's `public` schema; old
  migrations are in `prisma/migrations-archive/`.
- Production `_prisma_migrations`: SWapp's 9 old rows removed, `0_init`
  resolved as applied. Uncle Invoice's 31 rows (same table) untouched; its
  `migrate status` reports up to date.
- The production build (`scripts/vercel-build.sh`) ran `prisma migrate
  deploy` and applied `20261118210000_options_template_default_unique`
  (log, 2026-11-18 20:21 UTC). Afterwards `migrate diff` production vs
  `schema.prisma` exited 0. Preview builds skip migrations (verified in the
  #152 preview log).
- CI job `migrations match schema` passed on #152.
- Backup before any change: `ripley:~/backups/swapp-db/prod-20261118T200824Z.dump`
  (+ `-schema.sql`, and `prisma_migrations-before-baseline-20261118.csv`).
  A test restore had all 145 tables; Brand 7 and MeetingLead 59 matched
  production.
- Local dev DB: `docker compose -p swapp-dev up -d` (127.0.0.1:5434, user and
  password `swapp`). On ripley the main checkout's `.env` now points there;
  production DB credentials moved to `~/.config/swapp/prod-db.env` (600), and
  `~/.local/bin/proposal-status` reads that file (verified). Backup of the old
  `.env`: `~/.config/swapp/southwestdigital-app.env.bak-20261118`.

Not changed, still pointing at production in their `.env`: worktrees
`southwestdigital-app-mobile-ux`, `swapp-seo-run` (an operator run made today)
and `worktrees/swapp-scanner`. Their owners should switch them to the local
database. Open branches with migrations in the old folder layout must rebase:
their new migration folders are applied by the next production deploy, so a
change already hand-applied to production would fail there.

Follow-ups: give Uncle Invoice its own logbook (`schema=uncleinvoice` on its
Netlify database URLs, after copying its rows to
`uncleinvoice._prisma_migrations`; Netlify masks the values, so this needs
Tom). Longer term, SWapp in its own Supabase project (database-hosting.md).

## 2026-11-17 — Local SEO geo grid (shipped)

PR #131 merged as `6b2aa0e` from `feat/local-seo-geo-grid`.
The staff-only `/local-seo` page configures a 3×3–9×9 grid, 0.5/1/2 mile
spacing, and up to 12 phrases. Default is 7×7 and eight phrases. It records
Google Maps ranking and competitor results, shows the grid, top-3 share,
average rank, competitor frequency, and rank history. Manual scans use Live;
the Vercel daily cron checks queued Standard results and starts one weekly
scan on Mondays.

The reviewed additive SQL is
`prisma/migrations/20261117170000_local_seo_geo_grid/migration.sql`.
It was applied on 2026-11-17 with `prisma db execute` through
`DIRECT_DATABASE_URL` on port 5432. A Prisma read-back verified the three
expected tables: `LocalSeoConfig`, `LocalSeoGridCell`, and `LocalSeoScan`.
DataForSEO credentials are configured as Vercel Production secrets:
`DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, and `CRON_SECRET`. Values are kept
out of the repo. The grid parser uses the recorded fixture at
`src/lib/localSeo/__fixtures__/maps-serp.json`.

First live Standard scan completed and is visible on `/local-seo`. The first
3×3 test used one phrase: 9 of 9 cells completed, all rank 1, estimate and
actual charge $0.0054; the account balance moved from $1.00 to $0.9946. PR
#138 (`c442b35`) fixed the versioned Maps endpoints. PR #141 (`c84b38a`) fixed
Standard task cost accounting after task-get responses repeated the
task-post cost; the test record's `actualCostUsd` was corrected to $0.0054.

The first full scan ran on 2026-11-17 as a Standard run: 7×7 points, eight
phrases, 392/392 cells complete. There were 96 ranked points, all in the top
3; 296 points had no matching listing. Top-3 share was 24.5% across all
points; average rank was 1.18 among the ranked points. Estimated and actual
cost were both $0.2352, within the user's $0.25 cap; balance moved from
$0.9946 to $0.7594. Fifty-eight tasks returned DataForSEO status 40102
(`No Search Results.`); each was verified and saved as a completed,
not-found cell. This PR makes future scans handle that response the same way.
The next weekly scan is Monday, 2026-11-23 at 15:00 UTC. A signed-in visual
review of the page remains outstanding.

Checks on Ripley: `npx prisma validate` passed; Prisma Client generated with
fake local-only database URLs. `npm run typecheck` passed. `npm run lint --
--quiet` passed. `npm test` passed: 136 files, 1058 tests passed, 5 skipped;
1 test file skipped. `git diff --check` passed. `npm run build -- --webpack`
passed with fake local-only DB URLs and `PLATFORM_BASE_URL=http://localhost:3000`.
PR checks passed: typecheck/lint/test, Vercel preview, and Netlify deploy preview;
Netlify Pages changed was skipped. Post-merge GitHub CI and the production
Vercel deploy passed. The remote topic branch is deleted. A signed-in visual
page review remains outstanding.

Cost at defaults: 392 SERPs. Standard weekly scan is estimated at $0.2352,
about $1.02 per month. Manual Live scan is estimated at $0.784. UI and server
enforce a $2.00 estimated cost cap per scan.

## 2026-11-16 — Channel graph on the Showrunner home (Ummon, showrunner-app tab)

- Tom wanted the desktop video graph on the first page of Showrunner on the phone. `/showrunner` now shows it above the three cards: `src/components/showrunner/ChannelGraph.tsx` (client SVG, tap a dot to highlight its topics and next watch, Watch on YouTube link) with `src/lib/showrunner/graph-layout.ts` (deterministic layout, no d3 dependency) and `graph-layout.test.ts`.
- Data is a SNAPSHOT: `src/lib/showrunner/channel-graph.json`, copied from showrunner-app `Data/channel-graph.json` (25 videos, 2026-11-16, views read from the public watch pages). It goes stale as the autopilot publishes: refresh by copying that file again. A live feed is the next step.
- Phone labels are hidden until a dot is tapped; from the `md` breakpoint up every title shows. Not yet seen on a real phone at merge time.

## 2026-11-13 — Phone uploads over 3 GB (Ummon Claude)

- Tom's 4,969,898,905-byte `3964.mp4` was refused: every `PUT /upload` returned 400 "The piece is not valid." because `MAX_BYTES` was 3,000,000,000. The page retried silently and showed nothing, so the pick looked like it vanished. `MAX_BYTES` is now 60,000,000,000 (ripley `/home` had 565 GB free). Any 4xx other than 409 now stops the retries and prints the refusal in red above "Your videos".
- Self-test adds a first piece of a 4,969,898,905-byte file (200). Page JS passes `node --check`. Installed to `~/.local/share/swapp-phone-intake/phone_intake.py`, `swapp-phone-intake.service` restarted.

## 2026-11-13 — Resumable phone uploads (Ummon Claude)

- Tom's 2,130,002,024-byte `3948.mp4` failed twice (phone connection reset after ~1-2 min; old receiver deleted the partial). The send page now PUTs 8 MiB pieces with `offset`; the receiver appends to `<file>.part`, answers 409 with the true offset on a mismatch, keeps the partial on a drop, and finalizes (sha256 receipt) when complete. `GET /upload-status` gives the offset; `GET /resume?name&size` returns a batch still waiting on that file, so re-picking the same video carries on. The page retries up to 120 times with backoff. A `.part` idle for 90 s shows as "Paused at N%".
- Checks: self-test ok (piece, 409, status, resume, receipt). Live from steelbreeze: 20,000,000-byte file, piece 2 dropped at 9,310,720 bytes, resumed, sha256 matched. Installed and restarted on ripley. The whole-body PUT path is kept for the older per-file tickets.

## 2026-11-13 — Phone queue and status list (Ummon Claude)

- Send page: each pick is one batch (`batch`, `count` query on PUT) saved under `~/swapp-phone-intake/<batch>/` with `.batch.json` (expected count, file sizes). Showrunner's `showrunner-inbox.timer` turns each complete batch into its own episode and writes `~/swapp-phone-intake/queue.json`.
- `GET /status.json?exp&sig` (send-page signature) merges live batches (sending %, received, incomplete) with `queue.json` (episode name, stage, errors). The send page shows it as "Your videos", refreshing every 4 s.
- Self-test ok (batch incomplete -> received -> episode row). Installed to `~/.local/share/swapp-phone-intake/phone_intake.py`, service restarted; from dalliance `/status.json` returned the first episode.

## 2026-11-13 — Phone send page link, no HTTPS needed (Ummon Claude)

- Tailnet HTTPS is impossible today: `tailscale cert` returns "your Tailscale account does not support getting TLS certs" and `tailscale serve --https=443` says Serve is not enabled, even after Tom opened the enable page. So the HTTPS page no longer PUTs to ripley. `/phone` now renders a signed link (`session\n<exp>` HMAC, 3 h) to ripley's own send page `http://100.98.89.93:8932/send`; the phone opens it as a top-level link (no mixed content) and PUTs same-origin with the session signature. `src/app/api/phone-intake/route.ts` and `PhoneSend.tsx` were removed.
- `/youtube/new` on a computer: choosing My phone shows numbered steps to finish on the phone.
- Vercel production now has `PHONE_INTAKE_SECRET` (sensitive) and `PHONE_INTAKE_PUBLIC_URL=http://100.98.89.93:8932`.
- Checks: `python3 scripts/phone_intake.py --self-test` ok; typecheck pass; lint 0 errors / 9 warnings; tests 1,036 passed, 5 skipped. From dalliance over the tailnet: send page 200, 5,000,000-byte PUT receipt SHA-256 matched, tampered link 403. A real phone upload is still untested.
- Receiver service runs a copy at `~/.local/share/swapp-phone-intake/phone_intake.py` (installed from this branch) so worktree removal does not break it. Re-copy after receiver changes.

## 2026-11-13 — Phone intake integration (current, Ummon Codex)

- Branch `feat/phone-episode-intake` was fast-forwarded to `origin/main` `db073d4` after saving the prior uncommitted work in `/home/tom/projects/patches/swapp-phone-intake-20261113.patch` and `/home/tom/projects/patches/swapp-phone-intake-untracked-20261113.tar.gz`. The stash restore conflicted only in this handoff; both dated sections were kept.
- `/youtube/new` now routes the phone choice to the signed-in `/phone` page. Production will not use the old `:8931` upload page. The phone intake ticket API refuses an insecure `http://` receiver in production; the Python receiver advertises Private Network Access for the HTTPS tailnet path.
- The ripley receiver on `100.98.89.93:8932` accepted a 1,650,000,000-byte generated file in 1.6 seconds; the receipt byte count, SHA-256, and file size matched. The test file and receipt were removed. This verifies the receiver on ripley, not a real phone browser upload.
- `python3 scripts/phone_intake.py --self-test` passed (accepted a valid ticket and rejected a bad signature). `npm run typecheck` passed. `npm run lint` had 0 errors and 9 warnings. `npm run test` passed 1,035 with 5 skipped. `PLATFORM_BASE_URL=http://localhost:3000 npx next build --webpack` passed; `/phone` and `/api/phone-intake` are in the build. The separate Phone sidebar item was removed so intake starts from YouTube > Create new video.
- Draft PR #103 is open; its CI typecheck/lint/test and Vercel preview checks passed. Ripley transient user services `swapp-phone-preview.service` (branch Next dev on `:3016`) and `treb-phone-preview.service` (TREB host proxy on `:3017`) are active. From dalliance, `http://100.98.89.93:3017/login` returned HTTP 200 with “Sign in to The Real Estate Bookkeeper.” The signed-in phone browser path has not yet been tried. After restarting the receiver, the first immediate CORS probe hit a short startup race (`curl` connection refused); the second returned HTTP 204 with `Access-Control-Allow-Private-Network: true`.
- Production remains unready: `PHONE_INTAKE_SECRET` and `PHONE_INTAKE_PUBLIC_URL` are absent from Vercel production; the receiver's current public URL is HTTP. Board action notices `767e7f8b8336` (Albedo) and `6978e171e147` (Severn) request agreement for HTTPS Tailscale Serve without disturbing TCP 5900 VNC. Do not merge this branch until the HTTPS endpoint and production environment are configured and a signed-in phone test passes. The user unit currently runs `scripts/phone_intake.py` from this worktree; move it to a stable checkout when shipping.
- Showrunner project creation, media assignment, edit mode, and YouTube publication remain outside this branch and await Johnny's contract response to `bafdc92148f1`.

## 2026-11-13 — TREB new-video preview (Ummon Codex)

- Branch `ummon/treb-new-video-entry` from current `origin/main`; local dev server on ripley `100.98.89.93:3001` remains running. Ripley `treb-dev-proxy.service` serves branded preview `http://100.98.89.93:3011/login`, forwarding to `:3001` with Host `app.realestatebookkeeper.com`. Dalliance fetch returned HTTP 200 and the TREB sign-in heading. Tom signed in and reached `/youtube` in the correct brand.
- YouTube page previously returned only an analytics connection prompt. Added a `Make a new video` entry before the analytics branch and `/youtube/new` source choice: phone, Canon C100 SD card, already on ripley. Phone choice links to current tailnet phone inbox `:8931`; this is a working stopgap, not the final authenticated transfer. `npm run typecheck` passed. Desktop visual review of the new screen is pending.
- Do not ask Tom to connect YouTube before asset ingest. Integration from SWapp upload receipt into Showrunner project folder and mode remains unbuilt. The project folder `~/Videos/showrunner-projects/TREB 261113 New Video` exists, but no media has been copied into it. Johnny/Severn board action notices `a3369a650eed` / `16688b07581f` seek agreement on the shared Showrunner contract before touching that repo.
- 2026-11-13 layout follow-up: Tom asked the new-video page to fill the main area like the other SWapp pages. The All Thing had no SWapp design page, so `concepts/swapp-design-guidelines.md` was added first (All Thing commit `d481c6d`): full-width outer page, desktop `p-8`, responsive inner grids. `/youtube/new` now follows that rule (`p-8`, source cards in 3 columns on large screens). All Thing lint reported 111 existing issues; none named the new page or its parent.
- 2026-11-13 analytics correction: Tom expects the existing YouTube analytics and Connect control on the same `/youtube` page. The new-video card pushed that control down; moved the analytics heading/status above it. Ripley dev DB has TREB channel ID `UCK8UR3T14CPAH-XeX_eBTKA` and an ACTIVE integration with ciphertext, but local `AUTH_SECRET` cannot decrypt it; there is no local `INTEGRATION_ENCRYPTION_KEY` or `YOUTUBE_REFRESH_TOKEN_TREB`. A Vercel production env pull did not yield a key that decrypts it (temp pull file removed). Therefore local preview cannot show analytics; the page now says that plainly instead of claiming the brand is unconnected. Never call this a complete analytics restore until the dev server has a working token. The local `/api/youtube/connect` also lacks `YOUTUBE_OAUTH_CLIENT_ID`, so do not ask Tom to click it as a repair.
- Tom settled the entry pattern: the eventual merge has one **Create new video** button at the top of `/youtube`; it opens a separate page for the multi-step setup. The previous large card is removed. Analytics stays below the button. The first page currently asks where footage lives; transfer and Showrunner launch remain to build.
- Source-choice correction (Tom, 2026-11-13): selecting “My phone” on dalliance had opened the temporary ripley uploader, whose native file picker could only see **dalliance** files. The desktop state now says to continue on the phone; only the phone state offers the temporary upload link. This is still a stopgap, not an integrated SWapp upload. Do not call the desktop picker a phone picker or ask Tom to use it for phone footage.
- Pre-merge correction (Tom requested merge 2026-11-13): the ripley `:8931` temporary uploader is now exposed only in development. Production phone view says upload is being prepared. The unavailable-connection copy no longer calls production a local preview. Full ingest and Showrunner launch remain unbuilt.
- Merge gate on `753ded3`: `npm run typecheck` passed; `npm run lint` returned 0 errors and 9 warnings; `npm run test` passed 1,032 tests with 5 skipped. An isolated `npx next build --webpack` compiled and typechecked but first stopped because `PLATFORM_BASE_URL` in this local checkout is not a valid HTTPS or local HTTP URL. Re-run with `PLATFORM_BASE_URL=http://localhost:3000` passed and generated 55 static pages, including `/youtube/new`. The build ran in detached `/tmp/swapp-treb-build-20261113` to avoid disturbing the live dev server.
## 2026-11-13 — Ummon (Grok, southwestdigital-app w2N:t4): phone send page

Branch `feat/phone-episode-intake` in `~/projects/worktrees/swapp-phone-upload`,
cut from `origin/main` `3d45828`. Not pushed. No Showrunner project is created.
Nothing is published to YouTube. Johnny still has the contract ask
`bafdc92148f1`.

- `/phone` — signed-in page. Pick videos and pictures. Each file gets a
  ticket, then the phone PUTs the bytes to ripley. The page shows byte count
  and sha256.
- `POST /api/phone-intake` — staff only. Needs `PHONE_INTAKE_SECRET` and
  `PHONE_INTAKE_PUBLIC_URL`. Cap is 3,000,000,000 bytes. Ticket lasts 3 hours.
- `scripts/phone_intake.py` — the ripley listener. User unit
  `swapp-phone-intake.service` binds `100.98.89.93:8932` and writes
  `~/swapp-phone-intake/`. Secret file `~/.config/swapp-phone-intake/env`
  (mode 600). Same secret is what the Next server must see.

The other Ummon tab stays on `~/projects/southwestdigital-app-mobile-ux`
`main`, 1 commit behind origin. Port 3001 is that checkout. This branch's
dev server, when running, is `http://100.98.89.93:3016/phone`.

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
