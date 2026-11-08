# Move sales pipelines into SWapp

## Direction

Tom directed on 2026-11-08 that SWapp become the working source of truth for
prospects, sales opportunities, pipeline progress, and monthly revenue data.
Sales SQLite is a migration source. Keep its records and sync intact until the
SWapp workflows and imported data have been checked; then make it read-only
before considering retirement.

This is a phased cutover. A partially migrated pipeline must not accept edits
from both systems.

## Current data flow

- SWapp has brand-scoped `Pipeline`, `PipelineStage`, `PipelineItem`, and
  `MeetingLead` records. The mobile dashboard and CRM pages already read these
  records.
- SWapp already supports moving pipeline cards between stages, editing next
  actions and due dates, editing values on lead detail, and archiving/restoring
  leads. These are useful working controls, but Sales-linked records still
  mark some fields as source-owned.
- `MeetingLead.pipeId` is the current stable link to a Sales SQLite deal.
- Sales SQLite stores fields that SWapp does not currently receive or represent
  fully: offer type, offer-specific lead step, monthly estimate, and one-time
  amount and kind. The current SWapp `MeetingLead.amountKind` field means the
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

1. **Agree on the Sales boundary.** Kassad identifies any Sales workflows or
   fields that must be kept. Record the mapping and owner on the board before
   changing the shared API or either system's write path.
2. **Finish SWapp as the operator screen.** Keep the existing stage move,
   next-action, due-date, value, and archive controls. A basic unpriced
   opportunity can now be created from a pipeline page using the fields SWapp
   already stores. Add value entry and the missing offer type, value basis,
   first-payment, and agreement fields only after their meanings and Sales
   mapping are agreed. Preserve current Sales-linked records and distinguish
   them from SWapp-created ones.
3. **Prepare an idempotent import.** Read SQLite without changing it. Match on
   brand plus the stable Sales deal ID (`pipeId`); use contact email/phone only
   to help review unmatched identities, never to merge opportunities silently.
   Keep existing SWapp IDs and history. Do not delete old rows.
4. **Dry-run and review.** Report source and destination counts by brand,
   pipeline and stage; monthly and one-time totals; duplicate candidates; and
   missing or unmapped fields. Resolve exceptions before writing any records.
5. **Import once and compare.** Back up the source, import with stable IDs,
   then read back SWapp counts, stage totals, amounts, and representative
   records. Check the mobile screens with Tom.
6. **Cut over writes.** Once parity is confirmed, stop Sales SQLite from
   writing pipeline changes into SWapp. Keep the SQLite copy read-only for
   reference until Tom agrees it can be retired. Keep independent Quo message
   collection only if it still serves a needed inbox/history role; it must not
   create a second pipeline source.

## Current holds

- No database rows, Sales SQLite records, sync settings, or shared API fields
  have been changed for this transition.
- Board action `e2a280b4269b` asks Kassad to review required fields and
  Sales-only workflows. The data-contract implementation waits for that
  agreement. Independent SWapp planning can continue.
- Do not treat `MeetingLead.amountKind` as monthly versus one-time: it currently
  stores `offer` or `invoice`. Do not add an opportunity form that writes
  guesses into this field or into `PipelineItem.baseValueUsd` before the value
  basis is settled.
- The local phone preview uses the shared Supabase database. A schema change
  or data correction must not be applied there until the migration gates are
  cleared and the change is reviewed.
