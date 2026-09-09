# Design note: unified work items / next-action system

Moved out of `HANDOFF.md` on 2026-09-08. This is design intent, not shipped
behaviour. The offers-side MVP has shipped; the CRM extension has not.


**Status:** **MVP scope shipped for offers** (see section 6 + 10 above — lifecycle stages, staleness thresholds, blue-button treatment, "Your move" list, follow-up compose templates, self-heal on view, mark-as-sent fallback). What remains future work: the CRM `PipelineItem` coupling, a cross-surface "On your plate today" view, auto-fire nudges, and per-brand thresholds. Sections below are the original design sketch; keep it for the CRM extension.

### The insight

Every actionable row across the app (offer, pipeline card, agreement, ticket) is really a *work item* with three attributes:

1. **Next action** — what needs to happen (Send, Resend, Advance stage, Nudge payment, etc.)
2. **Who owes it** — `waitingOn: STAFF | CLIENT`
3. **Staleness** — how long it's been sitting since the last touch

Blue/primary treatment is *earned*: shown only when `waitingOn = STAFF` **and** staleness ≥ a threshold. Neutral otherwise. That way scanning any list tells you at a glance what's actually on your plate today.

### Concrete surface: Manage Offers table

Currently the blue treatment lives on the View/Details button for every non-draft row, regardless of state. It should follow the state × Last-sent age:

| Row state | Fresh (under threshold) | Stale (over threshold) |
|---|---|---|
| Draft | Edit is blue (always your move) | same |
| Sent, not viewed | Neutral (client hasn't had time) | **Resend** goes blue; Last-sent cell tints |
| Viewed, not signed | Neutral | **Resend / follow-up** goes blue |
| Signed, not paid | Neutral | **Nudge payment** goes blue |
| Paid / completed | Nothing blue | nothing blue |

Thresholds TBD (user has not set them). Suggested starting points: 5 days no-view → nudge; 5 days viewed-no-sign → nudge; 7 days signed-no-pay → nudge.

### What actually needs to *trigger* when a client doesn't view/sign/pay

This is the conversion-critical part. Two flavors, either or both:

- **Auto-nudge to client** — templated follow-up email fires from the connected Zoho mailbox after N days of no-view / no-sign / no-pay. User must be able to preview + approve, or opt into full auto.
- **Staff task creation** — a work item appears in staff's "On your plate today" list saying "Follow up with Acme Corp — proposal sent 8 days ago, not viewed." Clicking it lands on the offer row (or a compose-follow-up screen).

Escalation ladder per stage matters: e.g., day 5 gentle nudge, day 10 second nudge with a different angle, day 15 archive-or-close prompt. The exact cadence should be per-brand configurable (v2) but ship with sane defaults.

### CRM connection

The CRM (`Pipeline` / `PipelineStage` / `PipelineItem`) today only tracks *where* a lead sits, not *when it was last touched* or *what needs to happen next*. To make the work-item model real, the CRM needs:

1. `PipelineItem.lastActivityAt` — bumped by move / note / call log / offer send / proposal view / sign / pay.
2. `PipelineItem.waitingOn` — `STAFF | CLIENT` enum.
3. `PipelineStage.expectedDwellDays` — per-stage staleness threshold (natural extension of `valueMultiplier`).
4. Lightweight `LeadActivity` table (or typed lead notes) so "last touched" is derived, not manually maintained.

### How CRM and Manage Offers talk to each other

The link already exists via `Contact`: `Quote → Contact` on one side, `PipelineItem → MeetingLead → LeadContact → Contact` on the other. Same person, both surfaces.

Shared signal in practice:

- **Send offer email** → bump `lastActivityAt` on any pipeline card whose lead is linked to that contact. CRM card stops looking stale, matching what the offers row now shows.
- **Client views the proposal** → bump the CRM card too (client did something).
- **Client signs** → CRM card auto-advances to a "Signed / awaiting payment" stage (leverage existing but unused `ContactTagAutomation`).
- **"On your plate today"** view unions rows from both sources — an unviewed 8-day-old offer and an untouched 12-day-old pipeline card both appear in the same list, same blue-treatment rule.

Framing: Manage Offers is a filtered slice of the CRM's work-item stream, scoped to `type = OFFER`. It's not really its own thing.

### Cut lines / open questions for next session

- Are thresholds per-brand configurable from day one, or global constants first?
- Auto-fire nudges vs. staff-approves-each — probably staff-approves in v1 to avoid embarrassment.
- Where does "On your plate today" live in navigation? (Homepage? New `/today` route?)
- Does the offer-send bump the CRM card even if the offer isn't attached to any pipeline item, or only if there's a linked card?

### Suggested build order when we come back (CRM extension)

Steps 1–3 and 6 (offers-side) have shipped in section 6 + 10 above. What remains:

1. ~~Add `lastActivityAt` + `waitingOn` to `PipelineItem`~~ → **still open.** Add `PipelineItem.lastActivityAt` + `waitingOn` + `PipelineStage.expectedDwellDays`.
2. ~~Add a `bumpActivity(contactId)` helper~~ → **still open for CRM.** Offer-side bumpers write to `Quote`; extend to also bump linked `PipelineItem` rows for the same contact.
3. ~~Retrofit Manage Offers~~ → **done** (section 6).
4. Retrofit pipeline board cards with the same visual language.
5. Add "On your plate today" view (union query across offers + pipeline items where staff-owned + stale).
6. ~~Add nudge templates + staff approval gate~~ → **done as manual staff-approves-each** (section 6). Auto-send is the v2 extension.

