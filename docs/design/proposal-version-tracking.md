# Design note: proposal version tracking

Moved out of `HANDOFF.md` on 2026-09-08. Design questions only — captured
2026-09-04 while wiring the hourly payment element.

**Partially overtaken by later work.** The `feat/saas-readiness` payment work
(commit `6357a0a`) added a frozen accepted-payment obligation
(`src/lib/engagements/acceptedPayment.ts`) and a single reconciliation path
(`src/lib/stripe/reconcileProposalPayment.ts`) that verifies intent id, amount,
currency, connected destination, livemode and selection hash before marking an
engagement paid. That addresses the *payment* half of items 5 and 6 below.

What is still genuinely open: there is **no `signedQuoteRevisionId`** anywhere in
the schema or `src/` (verified 2026-09-08), so the exact signed revision is
still not pinned, and the receipt still renders from current published state
rather than the signed revision. Items 1–4 are untouched.

## Deferred legal-record hardening

**Deferred 2026-09-14.** Do not stop the current revenue work for this. The
recent live $1 proposal test proved that the agreement text, its SHA-256 hash,
signature-consent fields, signer details, payment record, receipt, and signed
PDF download are working. The remaining work below is intentionally parked so
we can return to it after launch pressure eases.

When this work resumes, complete all of the following:

1. Pin the exact published `QuoteRevision` at signing time (for example with
   `Engagement.signedQuoteRevisionId`) and make the receipt and signed PDF use
   that revision forever.
2. Generate the signed PDF at signing time and save the exact bytes to private,
   durable object storage. Store its object key, SHA-256, byte count, and
   generation/version metadata. Never silently replace the artifact.
3. Write a dedicated signing audit event containing the engagement, quote and
   revision, signer data, consent flags, timestamps, document hash, request
   identifier, source IP and user agent. Add a payment audit event or link the
   signing event to the reconciled payment record.
4. Capture the real client IP in production by handling the trusted proxy header
   (`CF-Connecting-IP`) before fallbacks, and record which header supplied it.
5. Add an authorized staff retrieval/download path for the stored artifact, and
   verify retention, backup, and restore access.
6. Have counsel review the agreement and signing flow. The application can
   preserve evidence; it cannot promise that a court will enforce a contract.

Acceptance checks: repeated downloads return identical PDF bytes and hash; the
database links the artifact to the exact signed revision; the dedicated audit
event exists; production records the client IP rather than only the proxy; and
the artifact remains downloadable after later offer edits and app/template
changes.


**Status:** design questions only — nothing built. Captured 2026-09-04 while wiring the hourly payment element. Come back to this before the app supports enough real-client proposals that version drift matters.

### What already exists in the schema

- `QuoteRevision` — versioned snapshots per Quote (`version` int, `snapshotJson`, `publishedAt`, `supersededAt`). Every publish creates a new row and marks prior revisions superseded.
- The public `/proposal/[token]` page reads the latest revision (or the publishedSnapshotJson if no revisions).
- The Manage Offers "Edit" button already surfaces an amber warning when editing a viewed/signed/paid proposal, recommending duplicate-instead-of-edit for signed/paid deals.

### What's missing / undecided

1. **Staff visibility of version history.** No UI shows the version log for a Quote — you can't currently see "v1 published Aug 12, v2 published Aug 15, v3 published today" or diff two versions. Should live on the offer detail page, probably as a collapsible timeline.
2. **Client visibility of version changes.** If we republish while the client has the tab open (or has a bookmark), they get a different offer than what they last read. Do we warn them? Show a "This proposal was updated on X" banner? Force re-scroll of the agreement?
3. **Republish trigger.** Right now editing → publishing silently swaps the URL's contents. Should a republish auto-fire a "we updated your proposal" nudge to the client (with the same trigger machinery from the follow-up system)?
4. **Bumping the version.** Currently `QuoteRevision.version` increments on publish. Do minor edits (typo fix) also bump? Or only material changes (price, scope)? A "publish minor" vs "publish material" distinction might belong on the publish button.
5. **Signed-version pinning.** When a client signs, we should snapshot the exact revision they signed against. Currently the engagement holds the agreement text and the acceptance payload, but not a `signedQuoteRevisionId` pointer. If someone later republishes the offer, we should not silently overwrite what was legally agreed.
6. **Receipt page version.** The receipt currently reads the current published snapshot, not the signed one. Same fix as #5 — receipts must show the terms as signed, not the terms as currently published.

### Suggested build order when we come back

1. Add `signedQuoteRevisionId` on Engagement. Pin it in the sign route.
2. Update `/proposal/[token]/receipt` to load the signed revision, not the current one.
3. Staff-only version history timeline on `/offers/[id]`.
4. Client-facing "updated" banner when they revisit after a republish (compare their last-viewed version to current).
5. Auto-nudge on republish, opt-in per publish action.
6. Diff view for two revisions (nice-to-have for staff).

The [[unified-work-items-next-action-system]] follow-up mechanism can reuse these signals: a republish is another type of activity, and the client's re-view of a republished proposal is another activity bump.
