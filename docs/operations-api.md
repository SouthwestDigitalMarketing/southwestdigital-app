# Operations API

How agents tell SWapp Operations that a playbook duty was done. Design brief:
All Thing `concepts/swapp-operations.md`. Playbook:
`src/lib/operations/playbook.ts`. States: `src/lib/operations/schedule.ts`.

## The rule

A duty is green only when an agent posts evidence for it. No evidence after
the due time means **Overdue**. Nothing is ticked by hand. Evidence is a
claim with proof attached: put the numbers in `summary` and the link or id
that proves it in `sourceRef`.

## Terminal: `ops`

`scripts/ops.mjs` (on ripley: `~/.local/bin/ops`). Reads
`~/.config/swapp/operations.env` (`SWAPP_OPERATIONS_TOKEN`, `SWAPP_BASE_URL`).

```bash
ops board                                   # open work, problems first
ops duties                                  # duty ids
ops done daily-bank-feeds --client rodan-properties \
  --summary "Checking 4021: 3 pending before, 0 after; 1 portal question" --by sol
ops waiting daily-portal --client rodan-properties --summary "October Chase statement not uploaded"
ops needs-tom weekly-status-note --client bnb-getaway --summary "Draft in Zoho Drafts" --ref "Drafts UID 512"
ops failed daily-bank-feeds --client ari-warehouse --summary "QBO sign-in expired"
ops client rodan-properties --name "RODAN PROPERTIES, LLC" --starts 2026-11-19 --double 882165
ops done onboarding-quickbooks --client new-co-llc --qb new-co-llc --summary "Invite accepted; qb connected"
ops client-won <engagement-id>              # re-run the new-client steps (backfill, retry)
```

`--period YYYY-MM-DD` reports for an earlier due day; without it the newest
day the duty fell due is used. A repeated identical report is recorded once.

## HTTP

Bearer token; SWapp stores only its SHA-256 (`OPERATIONS_API_TOKEN_SHA256`).
Brand defaults to `bookkeeping-conroe` in `ops`; the API requires `brand`.

- `POST /api/operations/evidence`: `brand`, `duty`, `client` (client duties
  only), `status` (`done` | `waiting_client` | `needs_tom` | `failed`),
  `summary`, `reportedBy`, `sourceEventId`; optional `period`, `sourceRef`,
  `details` (JSON), `occurredAt`. 201 with the period, or `duplicate: true`.
- `PUT /api/operations/clients`: `brand`, `key`, `name`, `startsOn`; optional
  `doubleClientId`, `qbCompany`, `active`. Upserts by `key`.
- `GET /api/operations/board?brand=...`: every occurrence in the last 14
  days with its state.
- `GET /api/operations/clients?brand=...`: the roster with stage and
  `qbCompany`.
- `POST /api/operations/client-won`: `brand`, `engagementId`; re-runs the
  new-client steps.
- `GET /api/operations/gsa?brand=...`: paid proposal agreements whose GSA
  (General Services Agreement) is not signed yet, with tier, amount, paid date
  and the steps done so far.
- `POST /api/operations/gsa`: `brand`, `engagementId`, `step` (`drafted` |
  `sent` | `signed`); optional `done` (false clears it), `at` (ISO date),
  `folder` (the client folder under `ripley:~/projects/clients`). Marking it
  signed also fills empty "Service agreement signed" / "Initial payment
  received" dates on the contact's leads.

## A new client (automatic)

When a client pays a signed proposal (live Stripe payment), the webhook runs
`onClientWon` (`src/lib/operations/clientWon.ts`):

1. the engagement becomes the service record (monthly type, pricing, fee) and
   is linked to the contact (found by email, or created);
2. the contact gets `contract-signed`, `paid`, `active-client`, and for
   monthly work `monthly-bookkeeping` and `service-monthly-bookkeeping-active`,
   plus `review-pending`, which starts the Reviews pipeline;
3. open Pipe Prospects deals move to won and `lead` comes off;
4. the client joins Operations in the **onboarding** stage, which runs the
   one-time checklist (`cadence: "onboarding"` duties, due N days after the
   payment) instead of the recurring playbook.

What happened is posted as evidence on "Client set up in our systems"; a
failed step shows red there. Marking `onboarding-opening-balances` done moves
the client to **active** (the monthly routine) from the next day.

`qb-clients` reads the roster (`GET /api/operations/clients`): onboarding =
Setup, active = Active, former = Locked, matched by `qbCompany`. Companies not
on the roster still use the contact tags.

## Who is a client

Operations keeps its own roster (`OperationsClient`), seeded from Double's
active client list. `startsOn` is the first day duties are expected for that
client; deactivate with `ops client KEY ... --inactive`. Tracking starts
firm-wide on `TRACKING_STARTS` (2026-11-19).

## Service records

One row per paid service a client has (All Thing
`concepts/service-records-design.md`). MRR = agreed fees of monthly records
active today; a record starting later shows as "starting" and is not counted.

- `ops services` lists them with today's MRR.
- `ops service-load FILE.json` upserts a JSON array, in file order. Each
  object: `sourceKey` (your id; reloading updates the same row), `contactId`,
  optional `engagementId`, `product` (service key, e.g. `monthly-bookkeeping`),
  `basis` (`monthly` | `one_time` | `hourly`), `feeAmount` (per month, total,
  or per hour), `startDate`, optional `endDate` + `endReason` (`job_done`,
  `client_cancelled`, `terminated_by_us`, `agreement_ended`, `replaced`,
  `lapsed`), `evidenceSource` (`swapp_proposal`, `qbo_contract`,
  `agreement_file`, `paid_invoice`), `evidenceRef`, `evidenceDate`, optional
  `notes`, optional `previousSourceKey` (the record a fee amendment replaces).
- A monthly record needs a fee and a signed agreement (never `paid_invoice`).
- Records set the tags (Tom, 2026-11-18): `service-<product>-active` while a
  record of that product is active, `-ended` once all have ended, then
  `active-client` / `former-client`. This runs after every record save and
  nightly (`/api/cron/service-tags`, 06:15 UTC). `ops service-sync [--dry-run]`
  runs it by hand.
- The tag decides who counts: dashboard MRR and `ops services` count clients
  with `service-<product>-active` for a recurring product (one sold monthly in
  any record) and take fees from records. Disagreements are listed as
  mismatches (card, `/dashboard/revenue`, `ops services`).
- HTTP: `GET /api/operations/service-records?brand=SLUG`,
  `PUT /api/operations/service-records` with one object plus `brand`.

### How records open, and the daily check (step 4)

- **Paid SWapp proposal:** client-won opens the records from the accepted
  proposal (monthly from the first of the prepaid month; onboarding, cleanup
  and add-ons as one-time from the pay day). Skipped when the engagement
  already has records. Marking `onboarding-opening-balances` done ends the
  open onboarding record (job_done).
- **Signed agreement (QBO Contracts):** Intuit sends no completion email to
  Zoho or Gmail (checked 2026-11-18), so the trigger is the signed PDF saved
  in the client folder. `ops agreements-scan` takes every `*SIGNED*.pdf` under
  `~/projects/clients/<slug>/agreements/` whose builder JSON exists
  (`_leads/<slug>/agreements/vN/<slug>.json`) and opens what is missing
  (`POST /api/operations/service-records/from-agreement`). A product the
  client already has (active, starting, or a one-time job within 31 days) is
  skipped. `ops service-from-agreement JSON PDF` does one by hand.
- **Daily check:** `ops service-check [--fix] [--save]` reads this month's
  Sales by Customer from our QuickBooks (`qb`, read-only) and posts it to
  `POST /api/operations/service-check`. Items, each with an owner: billed with
  no record (Tom: no agreement on file), amount differs from agreed fees,
  active monthly with nothing billed (Sol), client still an open lead (agent:
  deals moved to won with `--fix`), duplicate won deals (Kassad; Sales invoice rows, `amountKind = invoice`, are skipped in both), tag/record
  disagreements (agent with `--fix`; a hand-set tag with no record is Tom's).
  `--save` writes `~/.local/state/swapp/service-check.json` for the scan review.

## ChatGPT bridge switch

Tom's ON/OFF switch for the ChatGPT <-> Herdr Gmail bridge (2026-11-28): SWapp
**Settings > Bridge** (platform operators only). One row in `BridgeSwitch`
(key `chatgpt-bridge`); no row = off. Same operations token.

- `POST /api/operations/bridge`: ripley's `bridged.py` heartbeat every ~30 s and
  on each mode change: `mode` (`off` | `active` | `idle` | `error`), optional
  `lastCheckAt`, `lastMessageAt` (ISO), `lastMessageUid`, `lastError`,
  `reportedBy`. Answers `{ enabled, changedAt, changedBy }`: the switch ripley
  follows. `turnOff: true` switches it off (agents: `bridgectl.py off`); the API
  cannot switch it on, only Tom's tap can.
- `GET /api/operations/bridge`: the switch plus ripley's last report as one
  plain `state` (`off`, `turning-on`, `turning-off`, `active`, `idle`, `error`,
  `not-answering` after 3 minutes without a heartbeat while on).

Ripley side: `ripley:~/controllers/chatgpt-bridge` (README there). Off means
ripley holds no Gmail connection; it only asks this endpoint every 30 s.
