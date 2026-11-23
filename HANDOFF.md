# SWapp handoff

## 2026-11-23 — Stuck scans explain themselves (Ummon, PR #229)

Tom: "why is the live SWapp spinning?" Diagnosis: his press on production created a requested run no poller picks up (the ripley poller watches 3101 only), so the icon spun forever and the sheet sat on Waiting. Same class of bug as a poller dying mid-run. Fix: `scanRunStaleness` (requested >4 min, running >30 min). requestScan supersedes stale runs with a fresh one; the claim endpoint reaps stale runs before claiming; getScanStatus reports `stuck` and the sheet says plainly the scan may never start and to tap Scan again. Verified live on 3101: planted a 10-minute-old requested run, poller run errored it ("Superseded...") instead of hanging; fresh presses still claim and finish. Gates: full suite 1332 passed / 5 skipped, PR #229 green. Production still has no poller and no SCAN_STATUS_TOKEN — that cutover is the follow-up.

## 2026-11-23 — Scan phone fixes (Ummon, PR #229)

Tom's phone review of production: the QuickBooks login screen came out of nowhere, the sheet vanished after switching apps, and the spinning icon ignored taps. Three small fixes, no data changes. (1) Scan button opens the sheet on every tap, even mid-scan (it was `disabled` while running — that was the dead tap); fresh scans still only requested when idle. (2) Sheet writes `#scan` to the URL while open and reopens from it after a reload, so a backgrounded phone tab no longer loses it; closing clears the hash. (3) One short line under the title explains the Log in link (opens QuickBooks in a new tab; the scan keeps running here). Note: 3101's `swapp-live serve` rewrites `.env.development.local`, wiping the appended SCAN_STATUS_TOKEN — re-append + restart after every serve. Gates: typecheck clean, eslint clean, full suite 1330 passed / 5 skipped, PR #229 all green. Demo on 3101 (fixes worktree); merge on Tom's yes.

## 2026-11-23 — SCAN PART 2: questions that teach (Ummon, PR #228)

Tap-answer questions, max 5 per scan (rest wait). New tables `ScanRule` (kind/matcher/action/active) and `ScanQuestion` (kind/ref/findingId/what/options/undo/answered), plus `pipeline` scan room (additive migration; baseline untouched). Kinds: sms-lead, form-brand, stale-lead, paid-verify, won-verify, no-contact, broaden. Answers apply immediately + save a rule + record undo (tags, leads, deals, contacts, rules all reversible); money/contract sends and deletes are never offered — those stay Tom's. `GET /api/scan/rules` feeds the poller; the poller consults keep/lead/form rules, syncs always-spam answers into the existing block list, and reports auto-applied items. Sync turns open fixLevel-2 findings into questions (domain-grouped broaden proposals after 3 similar answers; shared providers excluded; declines block re-proposals). Modal shows Needs-your-call with tap buttons, scoreboard (asked/answered/open this week, trending to zero), handled-automatically list, and Undo on recent answers. Rulebook seeded at All Thing `sops/scan-rulebook.md` (committed + pushed on main); agents add learned rows each scan session.

Verified: question-engine tests (answer/undo/sync/propose) plus live tap-answer + undo against disposable swapp_live (reopen-to-proposed and back, confirmed-paid rule + undo, DB left clean); forced scan created 5 questions from real judgments; rules endpoint live on 3101. Gates: typecheck clean, eslint clean, full suite 1330 passed / 5 skipped, PR #228 all green including migrations. Merge on Tom's yes; his taps start teaching from the next scan.

## 2026-11-23 — Scan tags engine + house-cleaning (Ummon, PR #228)

Tom's update: tags are the engine + every scan cleans house. New `src/lib/scan/tags.ts`: SIGNED engagements → `contract-signed` tag (proof: engagement row); DEPOSIT_PAID/ONBOARDING_PAID → `paid` tag + open deals moved to won (deposit implies the agreement; SOP: won needs both tags); stale NEW/CONTACTED leads 21+ days → judgment findings; won deals missing money/contract tags → judgments (room payments); `paid` tag with no payment proof → judgments, never auto-removed; `lead` tag with nothing open → removed (clear-cut per SOP). Judgment calls become ScanFinding rows (fixLevel 2 ask-first, roles sales-pipeline/mail-desk) plus a "N need your call (review list)" change line. Money/contract tags only ever land on proof. Added `pipeline` room via migration `20261123070000_scan_pipeline_room` (baseline 0_init untouched; schema-SQL test reads both).

House-cleaning in the poller: `mail-sort --apply` every scan (folders only, undoable); `mail-spam-patrol sweep` every scan (always-spam list → Spam, Tom's hourly review decides); full patrol `run` on manual scans only (AI cost; hourly timer covers auto). Never any permanent delete. Uncertain items file review findings instead: email-only texts, unknown-domain forms. Board note sent to Donna (cleanup rules owner) with what the scan runs.

Verified live on 3101 (prove-part1-1, manual): sort 0 moved, sweep 0, patrol judged 13 filed 0, tags 0 fixed + 9 judgments (real ones: won deals missing tags incl. SJ Equity, paid tag without proof), changes show "9 need your call". Gates: typecheck clean, eslint clean, full suite 1323 passed / 5 skipped, PR #228 all green. Merge still on Tom's yes (he is reviewing the sheet + now these lines). PART 2 (tap-answer questions → rulebook) builds after this, per brief.

## 2026-11-23 morning — QB one-liner + tick proof (Ummon, PR #228)

Tom's 8:47 AM update: QuickBooks line is now just `1. ! QuickBooks — Log in ↗` (explanation text removed from initial rows, legacy folds, and finalization). His screenshot still showed the old card + all waiting — diagnosis: his browser holds stale JS. The tall card has served on 3101 since 08:19 and his presses (14:14, 14:18, 14:46 UTC) all completed with correct rows; every dev-server restart invalidates the bundle, so his tab needs a manual refresh (HMR can't reach a slept/backgrounded phone tab). Proof run `prove-847-1`, timer-driven, no manual trigger: pressed 14:49:26 → running+all-scanning 14:49:34 → done 14:49:38, QuickBooks needs-you on top, rest done. Gates: typecheck clean, eslint clean, full suite 1318 passed / 5 skipped, PR #228 all green. Tom: refresh the 3101 tab, press Scan, rows tick within ~10s. Merge on his yes.

## 2026-11-23 morning — Full-screen sheet + proven pickup (Ummon, PR #228)

Tom's 8:09 AM update: modal fills the whole screen top-aligned (not a bottom sheet); long lines wrap so the Log in link never hides; scan still showed Waiting — fix and prove with a real run. `ScanModal` is now a full page (`fixed inset-0 bg-white`, `max-w-2xl`, `pt-6`), rows wrap (`break-words`, no truncate). Modal also refreshes on tab focus/visibility (backgrounded phone browsers throttle intervals — likely why his sheet looked frozen). Timer tightened to 10s (`OnCalendar=*:*:0/10`; idle fires are one cheap status check).

Diagnosis of his 8:09 screenshot: the backend was fine — his 8:09:04 press was claimed at 8:09:31 and done at 8:09:37 with correct rows. He was seeing the ≤60s minute-timer dead air (plus a possibly background-throttled modal). Proof run `prove-810-1` (row inserted exactly as requestScan writes it, timer left to claim it): pressed 14:11:12 UTC → claimed 14:11:18 → done 14:11:23, QuickBooks needs-you on top, rest done. Gates: typecheck clean, eslint clean, full suite 1318 passed / 5 skipped, PR #228 all green. Not eyeballed by me (no login); Tom reviews on 3101, merge on his yes.

## 2026-11-23 morning — Compact checklist + fast pickup (Ummon, PR #228)

Tom's 7:51 AM update: modal rows took too much space, and his screenshot showed every source stuck on Waiting. Two fixes. (1) Compact numbered checklist: one line per source (`1. ✓ Texts (Quo) — 2 new`), small glyphs (○ waiting, spinning scanning, ✓ done, ! needs-you), short result on the same line, no cards/pills/borders; login items stay on top with an inline `Log in ↗` text link; the two QBO rows merged into one QuickBooks line (access + Contracts share one sign-in; legacy two-row runs fold in the modal). (2) Stuck Waiting was real: the minute-timer left up to 60s of dead air after a press (his screenshot was ~8s after pressing, before the first poll). Timer now fires every 20s (`OnCalendar=*:*:0/20`; the 15-min auto decision still lives in the poller), and the poller posts scanning rows before the slow sync triggers.

Verified live on 3101: forced run claimed in seconds, closed with one `quickbooks` needs-you line on top and the rest done. Gates: typecheck clean, eslint clean, full suite 1318 passed / 5 skipped, PR #228 all green. Not eyeballed by me (no login); Tom reviews on 3101, merge on his yes.

## 2026-11-23 — Scan progress modal + logins first (Ummon, PR #228)

Tom's update: pressing Scan opens a modal with every source and live progress; login-needing sources are checked first and pinned at the top with a Log in button while everything else scans in parallel; closing never stops the scan. New migration `20261123050000_scan_sources` (`scan_runs.sources` JSON). `src/lib/scan/sources.ts` (8 sources, initial states, progress validation, needs-you-first sort) + tests. New token route `POST /api/scan/progress`; claim/request init sources; complete finalizes per-source detail (preserves needs-you; GA4 without a server key goes needs-you). Poller: login-check triggers first (`sales sync`, `voicemail-intake run` failures pin needs-you), then 4 sources read in parallel via threads, each posting progress; swapp/ga4 marked scanning until the server closes them. New `ScanModal` (polls 4s, Esc/backdrop close, Log in opens the sign-in page in a new tab — agents never sign in); `ScanButton` opens it on press, header icon still spins while running.

QBO Accountant + QBO Contracts rows are login-gated placeholders (status check only — the QBO sync itself stays later per the brief; no QBO session checker exists yet). Verified live on 3101: forced run wrote and finalized all 8 source rows (QBO needs-you on top, GA4 "Traffic refreshed: 199 sessions"). Gates: typecheck clean, eslint clean, full suite 1318 passed / 5 skipped, PR #228 all green. Not eyeballed by me (no login); Tom reviews the modal on 3101, merge on his yes.

## 2026-11-22 evening — Scan button v1 (Ummon, PR #228)

Tom's scan brief (`~/swapp-scan-brief.md`, money playbook `sops/sop-money-playbook.md`): one Scan button in the header; everything refreshable refreshes. Decisions Tom made: demo on local 3101 first (production wiring later), full auto-create into SWapp. Branch `ummon/scan-v1`, worktree `swapp-scan-v1`, demo `swapp-live serve <worktree> 3101` (swapp_live has migration `20261123040000_scan_runs`).

New: `ScanRun` table (requested/running/done/error + summary/changes JSON); token routes `/api/scan/pending|claim|complete` (`SCAN_STATUS_TOKEN`, video-status pattern); server actions `requestScan`/`getScanStatus`; `ScanButton` in the sidebar (collapsed: compact) and the phone header, Lochside operators only (Contigo excluded); ripley poller `scripts/swapp_scan.py` + minute systemd timer `swapp-scan.timer` (config `~/.config/swapp-scan/env`, state `~/.local/share/swapp-scan/state.json`).

Poller triggers `sales sync all` + `voicemail-intake run`, reads Quo SMS/DB-calls/voicemail (read-only sqlite), Zoho via `mail ls/read`; server creates Leads + contact cards (deduped) and matches signed-hints to open quotes by email or company name (statuses sent/completed, never auto-marks). Leads only for answered calls, genuine voicemails, real texts (2FA/system skipped), non-self forms; backfill bounded to 7 days.

Verified live on 3101: Derek Potts "Done." → "Stephanie Weddington: client says signed — check QuickBooks"; David Johns text + BCH call + 2 forms created leads; BBB robocall correctly spam; 2FA text and Tom's own form test filtered. Gates: typecheck clean, eslint clean (1 pre-existing warning), full suite 1313 passed / 5 skipped, PR #228 all checks green. Timer installed and fired (idle when nothing due). Pending: Tom's local review (I cannot log in; button rendering not eyeballed by me); merge on his yes. Production cutover later: SCAN token in Vercel + timer pointed at main checkout.

## 2026-11-22 evening — Brand colours on the carousels (Ummon, PR #226)

Tom's evening update: each carousel screen uses its brand's own BrandTheme colours for header, dots and card accents; Combined/Total gets a calm neutral. Readable in light and dark mode. New `src/lib/brands/swipePalette.ts` derives a light/dark palette from each brand's saved theme (contrast-adjusted, neutral fallback) with 2 unit tests. `BrandSwipe` accepts a per-view palette and paints the active slide's colours via CSS variables; the dashboard `CompanyCarousel` now rides on `BrandSwipe` (Total neutral, each brand themed) and the Website views pass their palettes through. Cards get a 3px accent top-border via `brand-swipe__card`. Gates: typecheck clean, eslint clean on touched files, full suite 1297 passed / 5 skipped, `git diff --check` clean, PR #226 commit `43f7c6c` all checks green (typecheck/lint/test, migrations, Vercel). Local review at `http://100.98.89.93:3101/website` and `/dashboard` is Tom's before merge; merge only on his yes.

## 2026-11-22 — Website three-view swipe (Ummon, PR #226)

Tom's 5:36 PM update adds the same Combined / Bookkeeping Conroe / The Real Estate Bookkeeper swipe pattern to `/website` for platform operators in Lochside. Desktop gets tabs and arrows; phone gets horizontal swipe and position dots. `BrandSwipe` is a reusable shell for other per-brand pages. The Website page keeps its period controls, cards, graph and tables in the same positions on all three views. Contigo continues to use its single-brand Website report. The app shell calls the combined Website view Lochside LLC and hides the settings brand picker there.

Both GA4 properties load in parallel from their saved brand themes (BKC `501531577`, TREB `543546215` in the local copy). Combined adds counts, trend points, goal targets and matching acquisition/landing/geography rows. Engagement and bounce rates are weighted by sessions, and comparisons are recomputed from the combined current and prior periods. Combined goal editing is disabled; each brand goal remains editable on its own view. If either property fails, Combined shows a clear unavailable message while the other brand view remains usable.

Real-data local review at `http://100.98.89.93:3101/website`: last 30 days showed 157 sessions combined = 140 BKC + 17 TREB, and 66 engaged sessions combined = 59 + 7. Desktop view showed the tabs and graph; a 390 px viewport showed position dots and switching to TREB. No client names appeared in the Website report. Tom's verdict on this updated local view is pending; merge only after his yes and green checks.

## 2026-11-22 — Lochside login and Contigo guard (Ummon, PR #226)

Tom's update makes Lochside Total the post-login destination for platform operators. `/auth/complete` now chooses the active Bookkeeping Conroe brand as the underlying data scope and redirects to `/dashboard` on the platform host, including the bare-IP local host. The dashboard names Lochside LLC in its shell and hides the brand picker there. Platform administration is a menu link; its page has a return link. The brand picker remains on other pages for settings. A brand-only user still cannot enter the platform host. A Contigo hostname retains its own brand after login, and the company carousel appears only when the active brand is Bookkeeping Conroe or The Real Estate Bookkeeper. Four new post-login route tests cover platform, bare IP, Contigo and access denial.

Local real-data review at `http://100.98.89.93:3101/dashboard`: a signed-in bare-IP `/auth/complete` opened Total directly; the sidebar showed Lochside LLC and the Platform admin link. I opened Platform admin and used its return link. Privacy mode was on during visual review. Tom's approval of the updated local view is pending; do not merge before he says it looks right.

## 2026-11-22 — Lochside real-data local review (Ummon, PR #226)

Rebased `ummon/lochside-view` onto `origin/main` after #227 added `SWAPP_DEV_SKIP_LOCK`. `swapp-live serve /home/tom/projects/worktrees/swapp-lochside-view 3101` runs as a persistent user systemd unit at `http://100.98.89.93:3101/dashboard`. It reads `swapp_live`, a local production copy made at 2026-11-22 16:17 CST. We reused that copy rather than running `swapp-live refresh`, which would forcibly drop the database while Tom's separate port 3100 server uses it. Additive migration `20261122221000_company_cash_flow` was applied to `swapp_live` only. Production was not changed.

For visual review, dev-bypass created `ummon-local-qa@example.invalid` as a local-only owner and gave it one active Bookkeeping Conroe membership in `swapp_live`. The browser's privacy mode is on. Real-data Total and BKC show $3,105 MRR / 5 active clients, 4 new leads and 8 offers sent in the last 30 days (4 awaiting now), and a 24-minute median business response time. TREB shows $0 / 0 clients, 0 leads, 0 offers and no replies. FCF says Awaiting closed books, as designed. Desktop and 390 px phone views were inspected, including switching to the TREB slide; no client names were in the inspected screenshots. The active-brand GSA alert is still present and uses privacy aliases. Tom's visual verdict on the live local link is pending; do not merge until he says it looks right.

Post-rebase checks: typecheck passed; lint 0 errors and 11 existing warnings; 1,289 tests passed and 5 skipped. Vercel/CI checks will rerun after the rebased branch is pushed.

## 2026-11-22 — Lochside company view (Ummon, branch `ummon/lochside-view`)

Tom asked for one calm company view with Bookkeeping Conroe and The Real Estate Bookkeeper as two front doors. `/dashboard` now opens for platform operators on a three-screen carousel: Lochside total, BKC, TREB. Each view keeps MRR/active clients, new leads, offers sent/awaiting and median response time in the same card positions; the total adds free cash flow. Public website links sit under each brand. Phone swipe, desktop tabs/arrows and phone dots navigate it. The previous active-brand dashboard stays in a collapsed Detailed dashboard panel; the brand switcher still governs settings and other pages. Single-brand users see only the previous dashboard.

Shared helper: `getCompanyMetrics({ actorUserId, isPlatformOperator, from, to, now? })` from `@/lib/companyMetrics` returns `{ total, brands, cashFlow, expectedMonth }`. It reads signed ServiceRecords and active recurring tags via `getRecordMrr`, brand-scoped leads/offers/Scorecard replies, and an exact median across both brands. It rejects non-operators. Showrunner Studio may use `cashFlow?.valueUsd` for the mountain, or `total.mrrUsd` with an explicit **MRR fallback** label; never call MRR free cash flow. Board notice `fa61b2e0eafd` carries the signature to the other Studio agent.

FCF storage is additive `CompanyCashFlowMonth` (migration `20261122221000_company_cash_flow`). It stores only a human-confirmed closed month from Lochside's own QBO, cash-basis P&L income and expenses, owner draw, tax set-aside, exact account names and close date. `scripts/company_cash_flow.mjs` reads QBO through the existing local `qb` command and posts through the existing operations token to `/api/company-metrics/cash-flow`; a nightly user timer template is included. It deliberately does **not** post without `~/.config/swapp/company-cash-flow.json` containing `closedThroughMonth`, `closedAt`, `ownerDrawAccount`, `taxSetAsideAccount`. It also refuses negative ledger components for review. The dashboard then shows the latest verified month and calls out when it is behind the prior calendar month. Before a verified row exists it says “Awaiting closed books.” Preview deployments share production's unmigrated DB; the helper treats the missing new table as no cash flow so preview stays usable. Production migration applies only after Tom approves preview and merge.

**Open accounting question:** QBO chart shows `Owners Draw` (Equity), but no identifiable tax set-aside account. `Taxes` is an expense; `Federal Taxes (941/943/944)` is payroll liability, and `Texas State Comptroller Payable` is sales tax. None can safely be called an income-tax reserve. Tom/Sol must name the actual tax set-aside account or decide how to record one, and confirm the last closed month and close date. Until then no FCF figure is posted. Owner Draw's October general-ledger net is negative, so the sync would require human review even if the missing tax account were resolved. Do not flip its sign automatically.

Phase 2 plan (not built): add an explicit brand label to lead, client and offer records, with a migration/backfill mapping the current two brand IDs to labels. Update all writes and filters to use that label inside one Lochside tenant, then reconcile counts and access. Keep the brand switcher until every settings and integration path has a company-level home, then remove it in a later release.

Checks: local Prisma migration applied; typecheck passed; lint 0 errors (11 existing warnings); 1,288 tests passed, 5 skipped, including new cross-brand and FCF tests; production build passed. PR #226 CI and Vercel deployment are green: `https://swapp-git-ummon-lochside-view-lochside-llc.vercel.app/dashboard`. A temporary local mock route (removed before commit) was viewed at desktop and 390 px phone widths; all three slide controls worked after using `localhost` so Next.js allowed its dev resources. The phone check led to moving position dots above the cards. **Pending:** Vercel preview itself redirects to Vercel login in this Codex browser; Tom must sign in before actual phone/desktop preview screenshots. `/unlock`, if reached, also belongs to Tom. No production merge before Tom reviews preview and says yes.

## 2026-11-22 — Showrunner Studio season update (Muse, branch `ummon/showrunner-studio-season`)

Tom's second update: season is local Conroe firm -> national brand. Metrics now read from the Bookkeeping Conroe brand (`resolveMetricsBrand`, falls back to the show brand when Conroe is absent); show-owned rows (episodes, mountain, videos) stay on the current brand. Every storyboard opens with the fixed logline as clip 1: guided draft, Johnny draft (prompt + post-enforce), beat-0 regenerate, and `validateForLock` all pin it; removing it fails the lock. Mountain card carries the milestone track (YouTube client auto-spotted from converted WON/youtube-source leads, outside-Texas + toll-free ticked by hand, manual override wins), stored as `ShowrunnerStudio.milestoneOverrides` (migration `20261122230000_studio_milestones`). New `national-shipped` storyline when an episode goes live. Canon synced from showrunner-app (logline, season question, brands, milestones). `canon.pilot` beats remain only as the contract-teaser fallback copy. Preview only; no prod merge until Tom says yes.

## 2026-11-22 — Showrunner Studio tells-rework (Muse, branch `ummon/showrunner-studio-tells`)

Tom's correction: Studio tells, not asks. Home screen now opens on "This week's story": `collectWeekSignals` counts the last 7 days from SWapp data only (quotes sent/viewed/accepted, new clients won, replies answered + median business reply time, ScorecardMonthly reports/transactions, videos live, CompanyRevenueMonth trend). `buildStorylines` turns them into 2-3 candidate storylines with metric bullets; a server refresh pre-drafts a 4-6 beat storyboard per candidate (Johnny, guided fallback). Tom picks one, optionally adds one line, or picks "none of these" and writes one line. The 5-question interview, its localStorage draft state, and the contract-pilot path are removed; edit/lock/shoot/publish flow unchanged. New `ShowrunnerStudio.storylines` column (migration `20261122220000_studio_storylines`). Privacy: headlines/metrics hold counts and the firm's own revenue position only; name filter widened for generic words (will/would/names/etc.) after a test proved "Will they sign?" blocked locking. No prod merge until Tom approves the preview.

## 2026-11-22 — Showrunner Studio (Ummon, branch `ummon/showrunner-studio`)

Tom asked for a phone-first weekly episode planner for The $10K Month. This branch adds `/showrunner/studio` (five-question interview, OpenAI outline, beat edit/reorder/regenerate, privacy check, lock, one-clip-at-a-time shoot mode, manual YouTube publish log), plus entry points on Showrunner Overview and Series. The contract pilot is selectable as a sanitized draft. `src/lib/showrunner/canon.json` is a deliberately public-safe port of the title, goal, waypoints, and five-beat `the-contract` pilot from ripley's `showrunner-app/Data/series/the-10k-month.json` as of 2026-11-22. It omits client-specific material and example pricing. Future canon changes need an intentional sync; SWapp cannot read ripley at runtime.

**State and handoff:** `ShowrunnerStudio` is one brand-scoped, RLS-protected SWapp database row containing the mountain setting and episode log. It starts at Base Camp with percent display until Tom supplies a number and chooses dollars. The publish action snapshots mountain and firm-wide service number onto the episode and carries its hook to the next draft. Private interview answers stay in SWapp; the authenticated `GET /api/showrunner/studio/locked?brand=<slug>` returns only the locked storyboard and mountain using the existing `SHOWRUNNER_STATUS_TOKEN`. `scripts/pull_locked_storyboard.py` atomically writes `~/.local/share/showrunner/locked-storyboard.json` on ripley using the existing video-status environment. Johnny must wire that file into the autopilot; board action notice `027acea6d30e` records the contract. Upload still uses the existing phone → ripley path. Publishing is logged by pasting the YouTube URL in Studio; automatic status-to-episode matching is not built because there is no stable episode ID in the phone batch contract yet.

**AI:** SWapp had no prior LLM integration or Vercel key. Tom directed use of available OpenAI/Anthropic keys in this session. `OPENAI_API_KEY` is now set as a **Preview-only** secret in Vercel's `lochside-llc/swapp` project, sourced without printing its value from ripley's existing Showrunner config. The API uses `gpt-4.1-mini` Responses with `store:false`, a 25-second timeout, structured JSON, and per-user rate limits; failures produce a visibly labeled guided outline. The key was live-probed (HTTP 200). Production needs the same key when Tom approves the preview and merge; do not deploy the new Studio to production without his preview approval for this job.

**Checks:** local Docker migration `20261122204139_showrunner_studio` plus RLS migration `20261122210000_showrunner_studio_rls` applied. `npm run build` passed. `npm run typecheck` and `npm run lint` passed (lint 0 errors, 10 existing warnings). Full `npm test` passed 1,273 tests, 5 skipped; Studio targeted tests (18) pass. Crew review ran three rounds and found privacy, data-loss, hook, snapshot, concurrency, cross-brand localStorage, and pilot gaps; those were fixed. PR #223 opened 2026-11-22: CI (typecheck/lint/test, migrations match schema) green, Vercel preview deployed. Phone/desktop eyeball screenshots were not taken (no agent browser for Muse; needs Tom). Tom approved merge same day. Privacy checks are defense in depth; Tom's lock attestation remains necessary because free-form names cannot be detected perfectly.

## 2026-11-22 — Ummon session close (agreements / GSA work)

- Shipped this session: #185 #186 #187 #189 #190 #192 #195 #199 #201 #203 (agreement PDFs from ripley,
  phone layout, GSA alarm strip + panel, DRAFT stamp, versioned names). ripley receiver installed copy ==
  origin/main `scripts/phone_intake.py`.
- SJ Equity: GSA v4 FINAL sent 2026-11-20 via QBO (0/1 signed at last check, 11/21). When Derek signs:
  save `~/projects/clients/sj-equity-llc/agreements/v4/2026-11-20_GSA_SJ-Equity-LLC_v4_SIGNED.pdf` and
  POST `/api/operations/gsa` step `signed` (strip then clears).
- Open: Sales PRs #84/#85 (builder changes, Kassad merges); Tom's idea 3 (payment = "Paid, GSA needed",
  only GSA signed = Won, needs Kassad); idea 4 (pre-fill Exhibit A from the proposal). Ummon's Zoho draft
  UID 478 (heads-up email) is stale: a version was sent 11/20 per the client diary; trash it, do not send.
- Lesson: run `npm run lint` before every PR (#185 merged with a lint error and failed main CI).

## Working agreement — SWapp merges (Tom, 2026-11-21)

"You don't have to keep asking to merge. Just go ahead and merge." Once a change is built, checks
are green and it is checked (preview or render), squash-merge it and report; do not stop to ask.
Still ask first for anything outside SWapp code (production data, outbound sends, secrets).

## Lessons and open follow-ups (Ummon, 2026-11-22 wrapup)

- Before telling Tom a video is stuck, re-read live status (production `ShowrunnerVideoStatus`
  read-only, or ripley `~/swapp-phone-intake/queue.json` now). On 2026-11-21 I reported TREB 261121
  "stuck at Uploading to YouTube" from a queue.json copy taken before Tom re-signed at 12:33; it
  had published 12:39. Correction posted (board ce96990adf85) and told Tom.
- Each preview worktree needs its own `npm ci` + `prisma generate`; a symlinked shared
  node_modules carried a stale Prisma client and missed packages (2026-11-21).
- Waiting on CI/deploys: use an until-loop; the harness blocks `sleep N && ...` (2026-11-21).
- **Open bug:** `showrunner/videos/AllVideosBrowser.tsx` writes the view cookie with
  `path=/youtube`; after the move to `/showrunner` the Detailed/Condensed choice does not persist.
  Change it to `path=/showrunner`.
- Parked by Tom: Zoho calendar on the dashboard strip. Do not start.

## 2026-11-22 — Reports (client list, why-card, statements, bank feeds): how it works (Ummon)

Home for this work was Herdr workspace "Client Reports" (w2N, closed 2026-11-22). Pages are served by
ripley's receiver, not Vercel: SWapp `/reports` signs a link (`src/lib/phone-intake/ticket.ts`) and
redirects to `http://100.98.89.93:8932/reports` (tailnet only). Installed copies live in
`~/.local/share/swapp-phone-intake/` (copy from `scripts/` after each merge; restart
`swapp-phone-intake.service`; backups `phone_intake.py.bak-*`).
- **Status job**: `scripts/report_status.py`, unit `swapp-report-status.{service,timer}` (hourly) writes
  `report-status.json`. Double API: `/api/clients/<id>/end-closes`, `/api/tasks/?endCloseId=` (no
  client-questions endpoint exists). Tags: done / on-track (to 5th business day) / waiting / late /
  catching-up (no close for the due month).
- **Statements** (`scripts/statements.py`): owed = Double reconciliation tasks with 4 digits (dead ones
  skipped; per-client `~/.config/swapp-phone-intake/report-statements.json` {skip, add}); arrived = every
  PDF under `~/projects/clients/<folder>` (filed names first, else period + digits from text; cache
  `~/.cache/swapp-reports/statements.json`). Card: in / missing / not issued yet / none on file,
  covers-through, estimated next end, overdue ends; report months say "Built without".
  Scanned statements (Bayou WF x6823) need OCR: not built.
- **Bank feeds** (`scripts/bank_feeds.py`): QBO API has no feed status; Sol records each account from the
  Banking page (`bank_feeds.py set ...`) into `bank-feeds.json`. Disconnected/error -> waiting.
  Cadence: All Thing `sops/sop-bank-feed-review.md` § Checking bank connections.
- **Waiting by hand**: `~/.config/swapp-phone-intake/report-waiting.json` {"<folder>": "reason"}.
- Open: Sol to curate owed-account lists for all 8 clients; AAA Woodforest feeds disconnected since
  2026-08-29 (2 emails, no text yet); BnB LOC x4335 no statement after 2026-04-17.

## 2026-11-21 — Videos in progress: full width, title, thumbnail, details (Ummon)

Brief from showrunner-app (w33, Showrunner PR #186 adds the fields to queue.json). Migration
`20261121180000_showrunner_video_card`: `ShowrunnerVideoStatus.title` (text), `thumbnail` (text,
inline `data:image/jpeg;base64,` ≤200 KB, base64 charset only), `details` (jsonb: lengthSeconds,
graphics, quickbooksScreens; integers only). `VideosInProgress`: full width; md+ two columns
(steps + bars left; thumbnail, "21:39 long · 22 graphics · 0 QuickBooks screens", Watch on
YouTube right; dashed "Thumbnail not made yet" on wide screens); phones stack thumbnail under the
steps. Heading = YouTube title, project name small under it. Checks: tsc, lint, vitest 1255
passed, `next build` ok; local preview with three rows pushed through the real API (4 steps in;
TREB 261121 with thumbnail; published) at 1280 and 412 px.

## 2026-11-21 — Video status: per-step unit and current item (Ummon)

Tom wants to see which show graphic is being added. `render` in queue.json / `POST
/api/showrunner/video-status` now also accepts `pieceLabel` (≤30 chars, e.g. "Graphic"; bar reads
"Graphic 12 of 50", default "Piece") and `pieceName` (≤80, shown as "Now: Lower third"). `render`
still needs `total`. The showrunner-app agent (w33) was briefed to report these during "Adding the
show graphics". Checks: vitest src/lib/showrunner 17 passed.

## 2026-11-21 — YouTube folded into Showrunner (Ummon)

Tom: "combine showrunner and YouTube… one single process… it should be showrunner". One menu item,
Showrunner, tabs Overview (channel stats + Videos in progress, was /youtube) · Videos · New video ·
Series (graph, continue/new series; also active on /showrunner/new-series). Files moved from
`src/app/(app)/youtube/` to `showrunner/` (goal action → `goal-actions.ts`); old Showrunner page →
`showrunner/series`. `/youtube` and `/youtube/*` redirect to `/showrunner/*` (next.config.ts; the
Android send app opens /youtube). Keyboard: Showrunner takes `g y`, alias "youtube". `SectionTabs`
gains `also`. Checks: tsc clean, vitest 1252 passed, local preview: all tabs and both redirects 200
with the right tab active.

## 2026-11-21 — Section tabs for Agreements and Settings (Ummon)

Agreements: Agreements · Templates · Client PDFs (opens ripley's viewer, needs Tailscale); the PDFs
card, the Templates button and "Back to Agreements" are gone (New agreement stays). Settings:
General · Security · Tags; the Security link on General and "← Settings" on Tags are gone. Checks:
tsc clean, vitest 1252 passed, local preview 412 px: all five pages 200 with the right tab active.

## 2026-11-21 — Section tabs; YouTube first (Ummon)

Tom: big menu sections get their own tab row instead of back links ("flat hierarchy").
`src/components/SectionTabs.tsx` (client; active = exact or path prefix; scrolls sideways; theme
tokens). `src/app/(app)/youtube/layout.tsx`: Overview · Videos · New video. The All videos /
Create new video buttons and both "Back to YouTube" links are gone; `InProgress` keeps Videos in
progress on Overview. Next: Agreements and Settings.

## 2026-11-21 — All videos opens Condensed by default (Ummon)

Tom: "make condensed the default view". `/youtube/videos` opens Condensed unless the
`swapp_videos_view` cookie says `detailed`.

## 2026-11-21 — All videos: Condensed view, search and sort (Ummon)

Tom: a condensed mode (small thumbnail + title, one row) and a filter. `/youtube/videos` now has a
Detailed / Condensed switch (cookie `swapp_videos_view`, path /youtube, read server-side so the page
opens in the last view), a title search (all words must match) and a sort: Newest / Most viewed /
Best % watched. `AllVideosBrowser` (client) wraps the shared `VideoList` (`condensed` prop).
Checks: CI on the PR; 412 px sample renders of both views.

## 2026-11-21 — YouTube: All videos screen, roomier rows (Ummon)

Tom: published videos don't belong in Videos in progress; Top videos too cramped. YouTube screen
now shows only unfinished videos (`url` null) and an **All videos** button. `/youtube/videos`
lists every upload (`src/lib/youtube/uploads.ts`, uploads playlist, newest first) with lifetime
views / avg % watched / watch time (`getTopVideos` oldest upload → today, 200). Shared
`VideoList`: thumbnail + full title + date, labelled 3-number row underneath; Top videos uses it.
Checks: CI green on #206; 412 px sample render. Not seen with live channel data (YouTube keys
only on production).

## 2026-11-21 — App lock: PIN or Face ID / fingerprint, monthly change reminder (Ummon)

Tom: a 6-digit PIN on SWapp with biometrics, reminded on the 1st of each month to change it;
"just my accounts". Required for `PIN_REQUIRED_EMAILS` (`src/lib/app-lock/policy.ts`: Tom's 3
accounts); others opt in at Settings → Security, after which the lock applies to them too.
`requireActiveBrandContext` and platform admin auth call `requireUnlocked` → `/unlock?next=…`.
Unlock: HMAC cookie `swapp_unlock`, 8 h, tied to user + `pinChangedAt` (a PIN change relocks other
devices). PIN rules: 6 digits, no repeats or straight runs; scrypt; 5 wrong → 15 min. Forgot PIN →
sign out → fresh Google sign-in (`signedInAt` in the JWT) → choose a new PIN. Passkeys:
@simplewebauthn v9, per rpId, `UserPasskey` table. Banner from the 1st (firm month) until changed.
Migration `20261120230000_app_pin_lock` (additive). Checks: vitest 1235 passed; local e2e 16/16.
Not tested: passkeys (need HTTPS; first test on production). Agents driving SWapp as Tom must stop
at `/unlock` and ask Tom (board 31f10796bffa).

## 2026-11-21 — YouTube screen shows Videos in progress (Ummon)

Tom backed out of a phone upload and the YouTube screen only offered **Create new video**. The
Videos in progress cards (ripley pushes status every 10 s; they refresh themselves) lived only on
`/showrunner`. `loadVideoCards` (`src/lib/showrunner/load.ts`) now feeds both pages; `NewVideoEntry`
renders the cards under the button in all four YouTube page states (nothing shown when no video is
in progress or published in the last 24 h). Checks: CI green on #204. Not seen with a live upload.

## 2026-11-20 — Agreement downloads always carry the version (Ummon)

Tom's phone said "already downloaded" for SJ Equity v2 because v1 and v2 had the same file name (v2 only
in a `v2/` folder). ripley `scripts/phone_intake.py`: a file kept only in a `v<N>` folder is served
with `_v<N>` added to its name (`..._v2_DRAFT.pdf`); names that already carry `_v<N>` or `DRAFT` are
not doubled. Self-test ok; live: SJ Equity download `..._SJ-Equity-LLC_v2_DRAFT.pdf`, 120,651 bytes.

## 2026-11-20 — Dashboard and Scorecard merged (Ummon)

Tom: "merge the dashboard and the scorecard… use your best judgment". One page, `/dashboard`:
GSA alarm, reporting period, billing calendar, **all-time totals** (Transactions recorded /
Reports issued / Client messages answered + per-month chart), **Waiting for a reply + Last
sync**, Revenue, Pipelines, Offers, **Response times** (own range tabs, `?rt=today|week|30d|90d`,
kept when the period changes, and vice versa), Reviews, Website, YouTube, folded **How we
measure**. Scorecard UI moved to `src/app/(app)/dashboard/_scorecard/` (`sections.tsx` plus the
moved charts/format files). `/scorecard` redirects; the sidebar item is gone; the keyboard
command "Scorecard" opens `/dashboard#response-times`. The page refreshes every 5 minutes
(was 60 s on Scorecard; Dashboard reruns GA4/YouTube on each refresh).

Privacy: `/dashboard` is now covered. With privacy on, MRR clients (and "starting"), pipeline
leads (`Lead A…`), the GSA alarm and the Scorecard lists are aliased server-side through one
`createAliaser()` (`src/lib/privacy/alias.ts`), so a client keeps one letter across sections.
Checked locally: 14 real names seen with privacy off, none on screen or in page data with it on.
## 2026-11-20 — Agreement versions: highest version wins, "v2 · Draft" first (Ummon)

Tom: versions must be in the file name; on a phone folders are invisible and names get cut. Naming
rule (All Thing `sops/sop-quote-and-contract.md`): `<date>_GSA_<Client-Slug>_v<N>_<DRAFT|FINAL|SIGNED>.pdf`.
ripley `scripts/phone_intake.py`: version from `_v<N>` in the name, else the `v<N>` folder, else 0;
GSA = "General-Services-Agreement" or a `GSA` token; GSA draft/signed = highest version, then date
(SJ Equity's v1 and v2 had the same name and v1 was winning). List rows lead with a coloured
"v2 · Draft" / "v2 · Final, ready to sign" / "Signed" line, then the file name and date.
Checks: self-test ok (same name in v1/ and v2/ -> v2; `_v3_DRAFT` beats both; labels); installed on
ripley; live SJ Equity list "v2 · Draft, v1 · Draft, Signed", View -> v2; 412px screenshot checked.

## 2026-11-20 — `_FINAL` agreements: ready to sign, no DRAFT stamp (Ummon)

ripley `scripts/phone_intake.py`: an unsigned agreement PDF with a FINAL token in its name
(`..._FINAL.pdf`, `AGREEMENT_FINAL`) is the execution copy: served as is (no DRAFT stamp) and listed as
"Final, ready to sign" (blue). Other unsigned PDFs are now labelled "Draft" (was "Unsigned"). GSA
`draft` still resolves to the newest unsigned GSA file, so a FINAL copy shows on View once saved.
Kassad's SJ Equity rewrite brief (`~/briefs/kassad-sj-equity-gsa-final.md`, board fa35063bba73) names
the execution copy `_FINAL`. Checks: self-test ok (FINAL served unstamped and labelled; "Finalize" does
not count); installed on ripley, live SJ Equity list shows Draft / Signed.

## 2026-11-20 — Scorecard big numbers (Ummon)

Tom: "how many total transactions we have categorized and recorded across all of our clients…
maybe reports issued as well". Top of `/scorecard`: Transactions recorded, Reports issued,
Client messages answered (all-time, this month, last month) and a per-month bar chart.
New table `ScorecardMonthly` (migration `20261120211041_scorecard_monthly`, additive),
`POST /api/scorecard/totals`, `src/lib/scorecard/totals.ts`, `TotalsChart.tsx`. Nightly
`scripts/scorecard_totals.mjs` on ripley (systemd `swapp-scorecard-totals.*`) reads QuickBooks
Transaction List with Created By / Last Modified By through bookbot-app's modules and counts
our team's touches by month; reports from the client folders. Definitions: docs/scorecard.md
§ Big numbers. First dry run 2026-11-20: 32,374 transactions (Dec 2025 – Nov 2026, 7 of 7
client books), 136 reports (Jan 2019 – Nov 2026). Rodan's books are kept by their own staff
(53 ours). Whole-book total including history before us is ~120k; deliberately not shown.
The migration was made with `migrate dev` on a scratch database on the local Docker server
(`swapp_ummon_scratch`): the shared dev DB has an unmerged `20261120230000_app_pin_lock`
applied and migrate dev wanted to reset it.

## 2026-11-20 — Reports follow SWapp's privacy switch (Ummon)

ripley `scripts/phone_intake.py`: a valid signed `/reports...` link with `privacy=1|0` sets this
host's `swapp_privacy` cookie (Path `/reports`, 1 year) and 302s to the same URL without the
param. SWapp's `/reports` always sends it, so Reports match the app's one switch each time they
are opened from SWapp. ripley's own header button still works for that tab. Forged/expired
links still 403 with no cookie. Self-test covers both values and the forged case.
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

## 2026-11-19 — Sidebar Website link; service check skips invoice rows; Sales cutover landed (Ummon, shipped)

- #172, #173, #174, #176: sidebar **Website** tool link (new tab, after Skool). Default URL per brand
  slug in `BRAND_WEBSITES` (`src/lib/brands/tools.ts`): bookkeeping-conroe, southwest-digital-marketing,
  real-estate-bookkeeper, contigo-accounting. melbourne-cfo has none (hidden until set in Settings >
  Sidebar tools; a stored URL always wins). No schema change.
- #177: Sales files one pipe-prospects row per Bookkeeping Conroe QBO invoice (`MeetingLead.amountKind =
  "invoice"`). `NOT_INVOICE_LEAD` (`src/lib/operations/deals.ts`) keeps them out of `markOpenDealsWon`
  and the service check's duplicate-won/open-lead query. Before this, AAA/Bayou/SJ showed as duplicate
  won deals. Live check after deploy: 1 item (Contigo billed, no agreement; Tom's), 0 duplicates.
- Sales: `ummon/sales-live-cutover` merged to main as LochsideLLC/sales #83 (563eb5a); `~/projects/sales`
  is on `main`; live `pipe mrr` reads service records ($1,230/mo, 4 clients on 2026-11-19).
- Checks each PR: tsc clean, vitest 1115 passed / 5 skipped (1106 before #176), `npm run build` ok, CI green.
- Quirk: `psql` rejects the prod URLs' query string (`pgbouncer`, `connection_limit`). For read-only
  checks take `DIRECT_DATABASE_URL` from `~/.config/swapp/prod-db.env`, strip everything after `?`,
  use port 5432, and wrap in `begin read only; ... commit;`.
- Open: Sales unittest has 12 pre-existing failures (8 F + 4 E, pull/push sync tests plus 3 known), same
  on main before #83: Kassad's. Kassad's side note: Rodan's kept deal also sits in Prospects Pipeline /
  Education + Interest Confirmation from the 11-18 client-won backfill; undecided. mailroom-app #82
  (scan review entry) still waits on Donna.

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
