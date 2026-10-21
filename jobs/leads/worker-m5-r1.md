# Leads M5 worker report

## Range

- Base: `315267c4cd0366f4652227f6dd529cfba9eb0284`
- Note and HANDOFF head: `73a2429174b3b837ddd74ece90f8ac30423df2a2`
- Branch: `crew/leads-six-steps`
- Scope: M5 design note only; M6 remains closed pending M5 review ACCEPT.

## Changes

- Added `jobs/leads/nurture.md` as an open design note. It preserves Tom's tentative first-cut inputs: convert the offer during days 0–7 after quote, with quote and contract expiring at day 7, then long-term nurture.
- Marked those inputs tentative and explicitly avoided presenting a final stage list or implementing stages or automation.
- Listed the decisions and triggers still needed, including the day-zero reference and expiry boundary, conversion meaning and outcomes, follow-up actions/cadence/channel ownership, entry to long-term nurture, stop/re-entry rules, scope, and pipeline versus reminder/task behavior.
- Updated `HANDOFF.md` to point to the note, record M5 as awaiting review, and keep M6 closed until M5 review ACCEPT.
- No application code was changed. No production database or environment, external contact, board CLI, push, PR, merge, or deploy was used.

## Checks and results

- `git fetch origin` — completed before work and again before the report commit.
- `git diff --check` — passed for the note/HANDOFF change and the report change.
- Application typecheck, lint, and full tests — not run; this milestone changes documentation only.
- Scratch or production database work — not needed; no migrations or database access were performed.

## Gaps and next step

- Stage names, triggers, timing rules, cadence, outcomes, and implementation remain undecided as listed in `jobs/leads/nurture.md`.
- Submit the design note for M5 review. Do not start M6 until `review-m5-r1.md` records ACCEPT.
