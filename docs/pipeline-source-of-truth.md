# Move sales pipelines into SWapp

## Direction

Tom directed on 2026-11-08 that SWapp become the working source of truth for
prospects, sales opportunities, pipeline progress, and monthly revenue data.
Sales SQLite is a migration source and read-only report copy. SWapp owns new
and edited pipeline records; the Sales sync may pull SWapp records into SQLite
but no longer uploads SQLite deal changes.

This is a phased cutover. A partially migrated pipeline must not accept edits
from both systems.

## Current data flow

- SWapp has brand-scoped `Pipeline`, `PipelineStage`, `PipelineItem`, and
  `MeetingLead` records. The mobile dashboard and CRM pages already read these
  records.
- SWapp supports moving pipeline cards between stages, editing names, contact
  details, estimates, next actions, due dates, and archiving/restoring leads.
  Deal detail also records service type, value basis, initial-payment date, and
  agreement date.
- `MeetingLead.pipeId` is the current stable link to a Sales SQLite deal.
- Sales SQLite supplied the initial offer type, offer-specific lead step, and
  value basis. The SWapp `MeetingLead.amountKind` field means the
  Sales document kind (`offer` or `invoice`), not monthly versus one-time value.
  Current dashboard totals read `PipelineItem.baseValueUsd`, which the legacy
  sync fills from the monthly estimate.
- This gap is why the dashboard cannot reliably distinguish monthly work from
  one-time work or show the actual payment and agreement milestones.
- SWapp contact MRR is a separate brand-scoped `Contact.mrrUsd` value. It is
  not derived automatically from an open Sales lead.

The source review is recorded in `HANDOFF.md` and Sales `README.md` under
"Leads steps", "Offers", and "How syncing works".

## Target SWapp record

Keep a person/contact separate from each opportunity. One person may have more
than one opportunity, including a paid one-time engagement followed by a new
monthly service opportunity.

Each opportunity needs:

- brand and linked contact/business;
- service or offer type;
- value basis (`monthly`, `one-time`, or `unpriced`) and amount;
- its actual pipeline and stage;
- next action and due date;
- first-payment status and date;
- agreement status and signed date;
- source reference and a dated change history.

Cold prospects remain separate from qualified opportunities. A monthly client
counts in MRR only when the brand's client record has a current monthly amount.
Pipeline estimates remain forecasts and do not increase client MRR.

## Cutover steps

1. **Map and preserve the current Sales workflow.** Tom assigned Ummon
   end-to-end ownership on 2026-11-08, including the Sales-to-SWapp boundary;
   no approval from another agent is required. Read the Sales implementation
   directly and preserve its useful fields and workflows. Sales deals have a
   stable numeric ID, a separate person/contact, service offer (`bookkeeping`,
   `onsite`, `training`), offer-specific lead step, monthly estimate, one-time
   amount and document kind, stage, next action, due date, and close state. Do
   not treat document kind as value basis.
2. **SWapp is the operator screen.** Existing leads are editable from SWapp,
   and new opportunities can be created with service type, basis, and value.
   Monthly and one-time estimates have separate dashboard cards; one-time
   amounts stay out of Lead MRR.
3. **Prepare an idempotent import.** Read SQLite without changing it. Match on
   brand plus the saved SWapp record ID (`remote_id`), with `pipeId` only as a
   fallback. Keep existing SWapp IDs and history. Do not delete old rows.
4. **Dry-run and review.** Report source and destination counts by brand,
   pipeline and stage; monthly and one-time totals; duplicate candidates; and
   missing or unmapped fields. Resolve exceptions before writing any records.
5. **Import and compare.** The additive opportunity fields were applied and
   backfilled for 51 matched Bookkeeping Conroe deals. Read-back confirmed all
   51, with 47 monthly offers and 4 one-time offers. The existing 2
   local-only pipeline records were left unchanged. Monthly values matched the
   pre-migration dashboard values; the existing one-time estimate stayed in
   the one-time card.
6. **Cut over writes.** Sales deal uploads are now disabled. Sales sync can
   still pull SWapp changes into SQLite; that copy is for reference and reports.
   Keep independent Quo message collection only if it still serves a needed
   inbox/history role; it must not create a second pipeline source.

## Current holds and ownership

- Tom assigned Ummon end-to-end ownership on 2026-11-08. Board action
  `e2a280b4269b` no longer blocks implementation; no other agent review is
  required.
- The dashboard MRR-goal migration was applied to the configured Supabase
  database on 2026-11-08 using the project's reviewed direct-SQL procedure.
  Read-back confirmed both columns exist and Bookkeeping Conroe has
  `monthlyMrrGoal=10000` and `leadMrrGoal=10000`.
- Sales SQLite was read only during migration. 51 matching records were
  updated in place in SWapp; no pipeline rows were created or deleted. Two
  local-only records were preserved. Sales deal uploads are disabled; pull
  sync now matches by SWapp record ID first and accepts SWapp values as the
  source of truth.
- Do not treat `MeetingLead.amountKind` as monthly versus one-time: it currently
  stores `offer` or `invoice`. Map the explicit Sales offer and amount fields
  into a separate value basis and amount on each opportunity; keep forecast
  values separate from client MRR.
- The local phone preview uses the shared Supabase database. Apply future
  schema changes only through the documented reviewed-SQL process and verify
  them by reading back the exact schema and affected rows.
