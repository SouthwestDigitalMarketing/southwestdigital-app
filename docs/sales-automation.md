# Sales evidence and the All Thing

Tom's 2026-11-08 direction: a lead should advance from observed work, without
re-entering the same facts in SWapp. Every meaningful lead or client change
must also update the All Thing, or show a visible pending or failed write.

## Ownership

- SWapp PostgreSQL owns contacts, opportunities, stages, source event IDs,
  forecasts, and the All Thing write queue.
- The source system retains the original email, call recording, transcript,
  calendar event, invoice, payment, or agreement. The All Thing gets a dated
  summary and a pointer, following `sops/sop-client-file.md`. Client financial
  records stay in `~/projects/clients`.
- Sales SQLite may pull SWapp records for reports. It must not upload deals.

## Event contract

An observed event has `brandId`, `source`, `sourceEventId`, `eventType`,
`occurredAt`, a concise summary, an optional linked `MeetingLead.id`, and a
source reference. `(brandId, source, sourceEventId)` is unique. Repeated scans
reuse the event and its single All Thing job.

The event and the All Thing job are written in the same PostgreSQL transaction
as a SWapp change. The worker on ripley reads pending jobs and writes the
appropriate All Thing page. It reads the page back before marking a job done.
Failed jobs retain their error and retry; they remain visible to staff. A
scheduled reconciliation finds SWapp events whose All Thing job is absent or
unfinished. PostgreSQL and the All Thing git tree cannot share a transaction.

## Stage evidence

| Observed fact | Result |
|---|---|
| Website visit | Aggregate analytics only; no named lead |
| Identified form, email, or call | Match brand and person; create contact or prospect if none exists |
| Discovery call establishes service need | Open the matching opportunity; record next action and follow-up |
| Calendar booking | Presentation scheduled; not presented |
| Completed presentation call | Presented, if recording or notes support it |
| Payment in the firm's books or SWapp checkout | First payment received |
| Completed agreement | Agreement signed |
| Both first payment and signed agreement | Won; hand to client service under `sops/sop-leaving-leads.md` |

An agent may extract candidate facts from email and transcripts. Uncertain
identity or stage evidence goes to an exception queue. The event still records
what was observed; the stage is not guessed. One person may have distinct
one-time and monthly opportunities; matching must use a source ID or a reviewed
opportunity link, not name alone.

## Build order

1. Event IDs, evidence history, and All Thing write queue.
2. All Thing lead diary layout and worker, with retry and read-back. Agree on
   shared hub/index edits before enabling the writer.
3. Website form, Zoho email, Quo call, and calendar collectors.
4. Link SWapp offers, payment, and agreement facts to pipeline transitions.
5. Daily reconciliation and staff exception view.

`AGENTS.md` stays short. Each job names one All Thing SOP entry point; those
pages link to the next procedure. Code enforces identity, evidence, and
paired-write rules so the outcome does not depend on an agent remembering a
long prompt.
