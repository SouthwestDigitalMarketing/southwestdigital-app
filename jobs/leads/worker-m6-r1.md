# Leads M6 worker report

## Range and state

- Base: `c62bba91f2bd571fd8590a84638b5909a2dbe3f8` (M5 ACCEPT head).
- M6 commit head: recorded in the final handoff after commit.
- Branch: `crew/leads-six-steps`.
- M5 review: ACCEPT, `/home/tom/.grok/team/swapp/jobs/leads/review-m5-r1.md`.
- Scope: documentation and report only. No application code, schema, migration, or test files changed.

## Proposed reply for Ummon to send Kassad

**Not sent.** Exact proposed text:

> M1–M5 are complete on SWapp’s `crew/leads-six-steps` branch, but these commits have not been pushed or deployed, so the step field is not live yet. After the SWapp M2 change is deployed with its additive database migration applied, each deal returned by `GET /api/pipe/deals` will expose the step inside the deal object as `"leadStep": "reach"` (or another step value, or `null`). The `POST /api/pipe/deals` request accepts the optional snake_case field `"lead_step": "reach"` (or another step value, or `null`); the POST response also returns it as `deal.leadStep`. Omit `lead_step` to preserve the stored step; send explicit `null` to clear it. Kassad: once that field is live, update Pipe’s remote-deal import field list (`REMOTE_DEAL_FIELDS`) and mapping/tests in `~/projects/sales` to read `deal.leadStep` from SWapp. Please preserve it on any later push by sending `lead_step` when Pipe has a value. The current pipe pull compares values from the full list and does not use `updatedAt`; that remains true for this scope.

The field becomes live only after the SWapp change containing M2 is shipped and the additive `MeetingLead.leadStep` migration is applied in the target environment. This branch has not been pushed, deployed, or applied to production. The request field is snake_case; the returned field is camelCase nested under `deal`.

## M1–M6 evidence

- **M1 contract audit:** `/home/tom/.grok/team/swapp/jobs/leads/contract.md`; worker report `/home/tom/.grok/team/swapp/jobs/leads/worker-m1-r1.md`; commits `d59fe59..a14d2fa` (audit round 1 and correction round 2). Established unknown fields were ignored before M2, caller-selected brand behavior, dedupe keys, and full-replace deal semantics. M1 worker report records `npm run typecheck` passed, lint passed (0 errors, 9 warnings), `npm test` passed (109 files, 1 skipped; 871 tests, 5 skipped), and temporary parser probes passed; no database was used.
- **M2 lead_step persistence:** code commit `208cdeb` and handoff commit `df769f0`; worker report `/home/tom/.grok/team/swapp/jobs/leads/worker-m2-r1.md`. Optional validated values are `reach|qb|book|call|quote|nurture|null`, persisted and returned. Additive migration was applied to scratch Postgres only per the M2 report; no production DB/env.
- **M3 six-step board:** code commit `ed85a1c`, handoff commit `db7efda`; ACCEPT review `jobs/leads/review-m3-r1.md`. The six named steps render as columns; card moves set `lead_step` and preserve `reach=lead`, `qb|book|call=talking`, `quote|nurture=proposed`. Review evidence: typecheck/lint passed; 111 files passed, 1 skipped; 881 tests passed, 5 skipped.
- **M4 timestamp behavior:** code commit `d966ff4`, handoff commit `315267c`; ACCEPT review `/home/tom/.grok/team/swapp/jobs/leads/review-m4-r1.md`. Stage and step moves advance `MeetingLead.updatedAt`; tests cover general moves and all six step mappings, including equal-clock +1ms. Review evidence: 111 files passed, 1 skipped; 882 tests passed, 5 skipped.
- **M5 nurture design:** note `jobs/leads/nurture.md`; worker report `jobs/leads/worker-m5-r1.md`; ACCEPT review `/home/tom/.grok/team/swapp/jobs/leads/review-m5-r1.md`, exact range `315267c4cd0366f4652227f6dd529cfba9eb0284..c62bba91f2bd571fd8590a84638b5909a2dbe3f8`. It retains the days 0–7 conversion window and day-7 quote/contract expiry, followed by long-term nurture, as tentative inputs only. It selects no final stages. Review: diff check passed; static document assertions 7/7 passed; application checks not run because documentation-only.
- **M6 handoff:** this report and branch `HANDOFF.md` document the exact proposed reply, response/request field casing, live condition, and Kassad’s follow-up action. No reply was sent.

## Checks and limits

- `git fetch origin` — completed at M6 start and immediately before commit.
- `git diff --check` — passed for M6 documentation changes.
- Typecheck, lint, and full tests — skipped; M6 changes only documentation and report files. Prior milestone results are listed above and are not claimed as rerun for M6.
- No production database or environment was accessed. No database operation was needed.
- No external contact or board CLI was used. No push, PR, merge, or deploy was performed.

## Gaps and next step

- Kassad’s Pipe changes are not part of this SWapp branch and remain to be done in `~/projects/sales` after the field is live.
- The M5 nurture note remains tentative. The timing and outcome decisions listed there are open; no final nurture stages are selected or implemented.
- M6 is documentation-complete. Do not treat the proposed reply as sent; Ummon can send it only through the normal authorized channel when appropriate.
