# Coding-agent handoff

**Current state only.** Rewrite this file each session rather than appending to
it. Historical session logs live in `docs/handoff-archive/`; durable design and
reference material lives in `docs/`. If a note here would still be true in three
months, it belongs in `docs/`, not in this file.

Updated: 2026-09-14 (America/Chicago). Machine: **ripley**.

## Read first

`AGENTS.md` is the map. Crews do not push, PR, or merge. Do not run
`prisma migrate deploy` / `migrate dev` / `db push`. Do not send outbound SMS
unless the owner named the recipient in this session.

## Repository state

- Branch: `feat/review-requests-hardening`.
- `origin/main` is `c400bb4` (PR #21, leads ship-policy wording).
- Working tree should be clean.

Local commits (oldest first):

| SHA | Message |
|---|---|
| `912ef44` | `fix(reviews): host-scope public tokens and stop lying about metrics` |
| `54fff48` | `fix(reviews): star rating first, 5 to Google, else private reasons` |

## What this branch does

Public `/r/[token]` is host-scoped like proposals. Open tracking is a client
action, not GET. Staff totals count the whole brand. Reminders have a 24h
cooldown and skip people who already responded.

The public page asks for 1–5 stars. Five opens the brand Google review URL.
One through four thanks them and asks why (Communication, Turnaround time,
Pricing, Quality of work, Something else with a text box).

## Live SMS already sent this session

Owner-authorized send to himself this session. The SMS link is production
`app.bookkeepingconroe.com` (`main`), not this branch. Do not send another SMS.

Brand Quo + Google review destination were saved onto Bookkeeping Conroe from
local env during that send.

## Health

Measured on this branch, 2026-09-14, ripley:

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test` | 99 files / 784 tests at `912ef44`; later commit adds review tests |
| Playwright `e2e/reviews.spec.ts` | 4 passed after `54fff48` |
| Live SMS | one send, owner-authorized, arrived |

## Left for the crew

Reviewer then Tester on this branch. Report gaps. Worker only if Reviewer
finds a real bug. Do not push. Ummon ships when Tom says.

Known leftover, not this job unless Reviewer says it blocks:

- Send dialog does not attach `contactId` even when a matching Contact exists.
- Production still shows the old two-button public page until this merges.

## First commands

```bash
git status --short
git log -5 --oneline
git fetch origin
```
