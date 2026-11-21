# Scorecard API

Two endpoints the Scorecard collector (`scripts/scorecard_collect.py` on
ripley) uses. What is measured and why: [`scorecard.md`](scorecard.md).
Contract types: `src/lib/scorecard/types.ts`.

Both use the Operations API token ([`operations-api.md`](operations-api.md)):

```
Authorization: Bearer <SWAPP_OPERATIONS_TOKEN>
```

Only its SHA-256 is configured on the server (`OPERATIONS_API_TOKEN_SHA256`).
Missing or wrong token: `401`. Server not configured: `503`. Unknown brand:
`404`. Rate limits: ingest 120 posts a minute, clients 60 a minute (`429`).

## GET /api/scorecard/clients?brand=bookkeeping-conroe

Every SWapp Contact of the brand with at least one ServiceRecord, sorted by
name. The collector keeps only events from these numbers and addresses, on or
after `clientFrom` and, for a former client, on or before `clientUntil`.

```json
{
  "brand": "bookkeeping-conroe",
  "clients": [
    {
      "contactId": "cmh1x2y3z0000abcd",
      "name": "Rodan Properties",
      "phones": ["+19365550101"],
      "emails": ["owner@rodan.example"],
      "clientFrom": "2026-11-13",
      "clientUntil": null
    }
  ]
}
```

- `phones`: `phoneE164` and `phoneNumber`, normalised to E.164 (US 10 or 11
  digits; anything else is dropped), deduplicated.
- `emails`: `email`, `secondaryEmail`, `businessEmail`, `personalEmail`,
  lower-cased and deduplicated.
- `clientFrom`: earliest `startDate` or `evidenceDate` of any record.
- `clientUntil`: latest `endDate`, only when every record has ended; else null.

## POST /api/scorecard/ingest

Up to 500 events per post. Events upsert on `(brand, sourceKey)`, so sending
the same event again updates it (the normal 14-day re-send is harmless).

```json
{
  "brand": "bookkeeping-conroe",
  "events": [
    {
      "sourceKey": "quo:msg:AC5f2e",
      "channel": "text",
      "kind": "text_reply",
      "contactId": "cmh1x2y3z0000abcd",
      "startedAt": "2026-11-19T09:02:11-06:00",
      "respondedAt": "2026-11-19T09:20:40-06:00",
      "responseVia": "text",
      "details": { "burst": 2 }
    },
    {
      "sourceKey": "quo:call:AC77aa",
      "channel": "call",
      "kind": "call_missed",
      "contactId": "cmh1x2y3z0000abcd",
      "startedAt": "2026-11-20T16:45:00Z",
      "respondedAt": null,
      "responseVia": null,
      "details": { "voicemail": true }
    }
  ],
  "sync": { "source": "quo", "coveredTo": "2026-11-20T16:45:00Z", "ok": true, "note": null }
}
```

Rules, per event:

| Field | Rule |
|---|---|
| `sourceKey` | `^[a-z0-9:._-]{3,200}$` (case-insensitive), unique per source item |
| `channel` / `kind` | `text`/`text_reply`, `call`/`call_answered`, `call`/`call_missed`, `email`/`email_reply`, `report`/`report_delivered` |
| `contactId` | a Contact of this brand, or null. An id from another brand (or unknown) is stored as null and counted in `contactsDropped` |
| `startedAt` | ISO 8601 date-time with `Z` or an offset; not more than 5 minutes in the future |
| `respondedAt` | same format, or null (still waiting); must not be before `startedAt` |
| `responseVia` | up to 40 characters, or null |
| `details` | a JSON object up to 2,000 characters, or null. Timing and match flags only; never message text |

A body problem (not an object, no `brand`, `events` not an array, more than
500 events, bad `sync`) rejects the whole post with `400`. A bad event is
skipped and listed; the rest are stored. If a `sourceKey` repeats in one post,
the last copy wins.

The server computes `clockSeconds` and `businessSeconds`
(Mon–Fri 8am–5pm Central, `src/lib/scorecard/hours.ts`); the collector does
not send them.

`sync` (optional) upserts the `ScorecardSync` row for `source` (`quo`, `zoho`
or `reports`): `lastRunAt` is the server time, `eventsSent` the number of
events stored from this post. Post it with an empty `events` array to report a
failed run (`"ok": false, "note": "IMAP login failed"`).

Response `200`:

```json
{
  "received": 2,
  "created": 1,
  "updated": 1,
  "rejected": [{ "index": 3, "sourceKey": "quo:msg:AC9", "error": "respondedAt is before startedAt" }],
  "contactsDropped": 0
}
```

## POST /api/scorecard/totals

Same Bearer token. One metric's monthly counts from the nightly totals job
(`scripts/scorecard_totals.mjs`); every month of that metric is replaced.

```json
{
  "brand": "bookkeeping-conroe",
  "metric": "transactions",
  "months": [{ "month": "2026-10", "value": 823 }, { "month": "2026-11", "value": 2517 }],
  "note": "32374 transactions, 7 client books"
}
```

- `metric`: `transactions` or `reports`.
- `months`: up to 1000, each a firm-local `YYYY-MM` not after this month, no repeats,
  `value` a whole number 0 to 100,000,000.
- `note`: optional, up to 300 characters (shown nowhere but the sync record).
- A `transactions` post also upserts the `qbo` sync record.

Response: `{ "metric": "transactions", "months": 12, "total": 32374 }`. 400 with
`{ "error": "..." }` on a bad body.

## How the page reads it

`getScorecardData(brandId, range, now)` in `src/lib/scorecard/queries.ts`:

- Ranges are firm-local days: `today`, `week` (Monday to today), `30d`, `90d`.
  An event belongs to the day its `startedAt` falls on in Chicago.
- `withinTargetShare` counts answered-within-target over all events, except
  open events still inside their target (not a miss yet).
- Reports come from Operations evidence `monthly-close` `done`: started at
  23:59:59 on the last day of the reported month, answered at the first done
  post's `occurredAt`, counted in the range of the day it was published,
  target 10 calendar days (clock time).
- Duties: each playbook occurrence due in the range (from `TRACKING_STARTS`)
  and already past its due time is on time (a done post at or before the due
  time), late (done after) or not done. `due` is the total of the three.
