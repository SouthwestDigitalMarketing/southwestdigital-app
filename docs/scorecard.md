# Scorecard

How fast we answer clients, measured from the source systems, shown at
`/scorecard` (sidebar, right after Operations). Tom named it 2026-11-20; the
numbers feed a public video, so every number must be computed, real and
explainable. Contract types: `src/lib/scorecard/types.ts`.

## What is measured (clients only)

A **client** is a SWapp `Contact` with at least one `ServiceRecord`. An event
counts only if it happened on or after the client's `clientFrom` (earliest
record `startDate`/`evidenceDate`) and, for a former client, on or before
`clientUntil`. Leads, spam, newsletters, vendors and Tom's own addresses never
count. Brand: `bookkeeping-conroe` (the brand that owns the records).

| Measure | Started | Answered | Source |
|---|---|---|---|
| Text reply (`text_reply`) | first incoming client text with no outgoing text or call to that number since the previous incoming one (a burst counts once) | first outgoing text (status delivered or sent, not "STOP") or outgoing call to the same number on the same Quo line | `sales.db` `messages`, `calls` |
| Call answered (`call_answered`) | incoming call `status=completed` with `answered_at` | `answered_at` (answered live); counted for the answered share | `sales.db` `calls` |
| Missed call (`call_missed`) | incoming call `status=no-answer` (`duration>0` = voicemail) | first outgoing call or outgoing text to that number after it | `sales.db` `calls`, `messages` |
| Email reply (`email_reply`) | first inbound email from a client address in a burst (skip `List-Unsubscribe`, `Auto-Submitted` not `no`, `Precedence: bulk`/`list`/`junk`, our own addresses) | earliest Sent message whose `In-Reply-To`/`References` holds its Message-ID (`details.match="thread"`); else earliest Sent to that address after it, within 7 days (`details.match="address"`); a call or text to that client's number in between also answers it (`responseVia` call/text) | Zoho IMAP headers only (INBOX, Archive, Personal; Sent) |
| Report delivered (`report_delivered`) | last day of the reported month, 23:59:59 firm time | the day the report was published: Operations evidence `monthly-close` `done` `occurredAt` | `OperationsEvidence` (tracking started 2026-11-19); no trustworthy history before that (PDF mtimes are save dates, Double API has no publish time) |
| Duties on time | each playbook duty occurrence due in range | newest `done` evidence with `occurredAt <= dueAt` | `OperationsEvidence` + `src/lib/operations/schedule.ts` |

Unanswered events keep `respondedAt = null`; open ones show on the live list.

## Business hours

Monday to Friday, 08:00 to 17:00 America/Chicago, no holidays yet
(`BUSINESS_HOURS` in `src/lib/scorecard/hours.ts`). Response times are business
seconds: time outside those hours does not count. Clock (24/7) medians are
shown alongside so the video can quote either honestly.

Targets (`withinTargetShare`): text 1 business hour, missed-call callback 1
business hour, email 4 business hours, report 10 calendar days after month end.

## Statistics

Median and 90th percentile (nearest-rank on sorted answered spans), plus
count and answered count. Never averages alone. Ranges: today, this week
(Monday start, firm time), 30 days, 90 days. Graphs: last 90 firm days, daily
median and p90.

## Flow

1. **Collector** on ripley, `scripts/scorecard_collect.py` (Python 3 stdlib),
   timer `swapp-scorecard.timer` every 5 minutes (`scripts/systemd/`).
   - `GET {SWAPP_BASE_URL}/api/scorecard/clients?brand=bookkeeping-conroe`
     (Bearer `SWAPP_OPERATIONS_TOKEN` from `~/.config/swapp/operations.env`).
   - Reads `~/.local/share/lochside-sales/sales.db` read-only
     (`file:...?mode=ro`), and Zoho headers over IMAP `readonly=True`,
     `BODY.PEEK[HEADER.FIELDS (...)]` (password via `pass show zoho/imap-ripley`).
   - Never reads or sends a body; never sends anything to a client.
   - `--backfill` sends all history; normal runs send the last 14 days (events
     upsert by `sourceKey`, so repeats are harmless). `--dry-run` prints counts.
   - Posts batches of up to 500 events to `POST /api/scorecard/ingest`.
2. **Ingest API** (`src/app/api/scorecard/ingest/route.ts`): same Bearer token
   scheme as the Operations API (`authenticateOperationsRequest`). Validates,
   computes `clockSeconds` and `businessSeconds`, upserts on
   `(brandId, sourceKey)`, upserts `ScorecardSync`. Returns counts.
3. **Page** reads `getScorecardData(brandId, range, now)`
   (`src/lib/scorecard/queries.ts`); report and duty measures are computed from
   `OperationsEvidence` at read time. Live: a client component calls
   `router.refresh()` every 60 s.

## Big numbers

All-time totals across the top of the page, each with this month and last month,
plus a per-month bar chart (last 24 months). They ignore the range picker.

- **Transactions recorded** — QuickBooks transactions in each client's books that
  our team entered (Created By) or last changed (Last Modified By), counted in the
  month that happened. Team = `Thomas MacDonald` (Tom's login, which our agents also
  use); our own books (Bookkeeping Conroe, Thomas Grant MacDonald) are skipped. Both
  lists can be overridden in `ripley:~/.config/swapp-scorecard/totals.json`
  (`{"team": [...], "skipCompanies": [...]}`). Transactions entered by a client's own
  staff or by bank-feed rules, and never changed by us, do not count. A
  transaction last changed by someone else after we entered it still counts in its
  create month.
- **Reports issued** — published `ripley:~/projects/clients/<client>/reports/<year>/<YYYY-MM>.pdf`,
  by the month each report covers (superseded copies live in other folders and do
  not count).
- **Client messages answered** — `ScorecardEvent` rows for clients with a response:
  text and email replies, live-answered calls, and callbacks, by response month.

`scripts/scorecard_totals.mjs` runs nightly on ripley (`swapp-scorecard-totals.timer`,
03:40 Central). It reads QuickBooks read-only through bookbot-app's own connection
code (`~/projects/bookbot-app/src/{config,qbo}.ts`, the same token refresh `qb` uses,
so it never races `qb` over saved tokens), counts, and posts one number per metric
per month to `POST /api/scorecard/totals`, which replaces that metric's months in
`ScorecardMonthly`. If any company's read fails, transactions are not posted and
yesterday's numbers stay. The QuickBooks run shows in Last sync as "QuickBooks
(nightly)", stale after 26 hours. `--dry-run` prints the counts; `--only reports`
or `--only transactions` runs one metric.

## Privacy

SWapp stores timing, channel, contact id and a match method. No message text,
subject, phone recording or file. Client records stay on ripley. Big numbers
are monthly counts only: no client, company, transaction or report detail.
