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

## Who is a client

Operations keeps its own roster (`OperationsClient`), seeded from Double's
active client list. `startsOn` is the first day duties are expected for that
client; deactivate with `ops client KEY ... --inactive`. Tracking starts
firm-wide on `TRACKING_STARTS` (2026-11-19).
