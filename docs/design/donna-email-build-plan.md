# Donna email build plan

Status: first read-only slice implemented, 2026-11-25. Product direction agreed
with Tom; execution and broader rollout remain later slices. Worktree
`swapp-scanner`, branch `donna/email`. See [the pilot runbook](../donna-email-pilot.md).

The local preview has the Donna desk, request pages, settings, an action-backed
Scorecard, signed webhook intake, durable leased jobs and the read-only Ripley
worker. Zoho's existing IMAP connection was verified to support IDLE, so the
worker can also listen for INBOX changes without a public webhook. Other folder
changes use the webhook or recovery reconciliation. Public webhook enrollment
and actual arrival-to-action latency have not been tested with the live account.

The pilot inventoried all 16 selectable Zoho folders, with 3,130 message
locations at its check, and prepared two real thread assessments. The remaining
1,932 threads are still pending; the pilot is paused for review. The first
build intentionally performs no live filing, tagging, CRM writes or sending.
Counts for those operations remain zero. This is the review gate described in
the first build slice below, not completion of all six stages.

## What we are building

Donna owns the email desk like a capable employee. She understands what people
need, makes routine decisions within her authority, completes useful work, and
follows through. Tom gets time back. Clients and prospects get served sooner.

An employee experience comes from reliable judgment, memory and execution. The
main screen should show what Donna has handled and what needs Tom, with enough
evidence to trust her. Her success is measured by reduced work and decisions for
Tom, faster resolution, and timely handling of sales opportunities.

Start with the existing Zoho business mailbox. Inventory the other configured
accounts so scope is explicit, but connect more accounts only after Zoho works
well. Phone, payments, contracts, bookkeeping execution and Showrunner changes
are outside this build. Email about those subjects still needs recognition and
a clear handoff or escalation.

## Existing foundation and gaps

- SWapp has findings, review queues, role assignments, a scanner page and workers
  on Ripley. Mailroom has working mail tools and spam/newsletter rules.
- The legacy `zoho_mail()` pass in `scripts/swapp_scan.py` reads the latest 25
  messages, skips seen IDs, and focuses on enquiries and agreement hints. That
  cannot establish that the whole email desk is handled.
- `docs/scan-sops/zoho.md` already calls for full pending queues and thread
  context. The build must make that an enforced behavior, with coverage evidence.
- `ScanFinding` can hold a finding and evidence; it does not yet represent
  request subtasks, approval versions, execution attempts and follow-up history.
- The Scorecard already measures response timing. Donna should share verified
  email events with it rather than create conflicting response counts.

Keep useful parts. Extend the model where it fits; add request/action records
where needed. Avoid a second independent mail client or task list.

## The daily experience

Donna works in the background. Opening her page does not start her work.

| View | What Tom sees |
| --- | --- |
| Needs you | A short decision, Donna's recommendation, and the completed draft or prepared work |
| Working | What Donna owns, its next action, and when it is due |
| Waiting | Who owes the next step and when Donna will check again |
| Handled | Completed work and its evidence, with undo where supported |

Urgent items surface immediately; routine activity stays in a short digest.
The page shows which mailbox is covered and when it was last checked. If access
fails, it says so. A disconnected mailbox must never look like an empty desk.
Use plain work descriptions, such as “March statements filed; reply ready.”
Keep process logs behind a details view.

### Pages and buttons

Proposed navigation: **Donna** in SWapp's main menu opens `/donna`.
The old `/scanner` entry points redirect as appropriate when the new page ships.
The product is Donna; the builder's agent identity remains Ummon.

1. **Donna home.** A brief “Today” summary, mailbox health and last checked time.
   Four tabs: **Needs you**, **Working**, **Waiting**, **Handled**, each with a
   count. Default to Needs you. Each row states the person, request, next action
   and age or deadline. Selecting a row opens its request page. **Check now**
   refreshes the background intake; normal operation never requires pressing it.
2. **Request page**, `/donna/requests/[id]`. **What they need**, **Donna's
   recommendation**, **Prepared work**, **Conversation and files**, and
   **Activity**. Expand source messages and attachments without leaving the
   request. A prepared reply shows the exact sender, To/Cc, subject, text and
   attachments. Buttons: **Approve and send**, **Edit reply**, **Give direction**.
   Only show actions relevant to the current request. Give direction takes a
   short instruction; Donna revises the prepared work before asking again.
   Approval must satisfy the current same-turn sending rule; the button's
   authorization integration must be resolved before enabling real sends.
3. **Working tab.** Request rows show owner, next action and due date. Open the
   same request page to inspect progress or give direction. No second task list.
4. **Waiting tab.** Each row states who owes what and the next follow-up date.
   **Change follow-up** adjusts that date; **Prepare follow-up** prepares a
   message without sending it. Replies update the request automatically.
5. **Handled tab.** Completed work with time and evidence. **View details**
   opens the same request page; **Undo filing** appears only for a verified
   reversible filing action. A sent acknowledgment alone cannot put a request here.
6. **Donna settings.** **Mailboxes**, **Standing rules**, **Notifications** and
   **Pause Donna**. A **Resume Donna** control appears when paused. Model names,
   worker logs and processing details stay out of the normal work flow.

Design lesson from Tom, 2026-11-25: when asked for a user journey, describe the
actual pages, sections, buttons and resulting transitions. An employee narrative
alone does not make the interface concrete enough to review.

## Build sequence

### 1 Establish the job and prove mailbox coverage

Inventory the Zoho folders, sent mail, existing rules, draft tools and scheduled
writers. Identify which process owns each action so the old scanner and Donna
cannot both move mail or create duplicate drafts.

Build a resumable intake queue driven by incoming-mail events. Establish a
complete mailbox inventory, inspect
the outstanding backlog, then process new or changed conversations continuously.
Start with people waiting and deadline mail. Include read and archived mail;
unread status is not a measure of work remaining. Check spam and newsletter
folders for misfiled legitimate work under the existing protection rules.

Use account identity, Message-ID, threading headers and provider mailbox identity
including UIDVALIDITY/UID as appropriate. Folder moves must not create new jobs.
Fetch full content and relevant attachments when assessing a conversation;
unsupported or unreadable attachments remain explicit gaps.

**Ready when:** all in-scope folders are accounted for, backlog counts can be
reconciled, restart resumes the queue, and a folder move or repeated intake does
not duplicate work. Proposed target: start assessing new mail within one minute
of receipt under normal load, subject to pilot measurement of provider delivery
and processing latency.

#### Incoming mail starts the work

Use Zoho Mail outgoing webhooks as the preferred incoming-mail trigger. Zoho
documents mail-triggered external notifications and request signatures in its
[webhook guide](https://www.zoho.com/mail/help/dev-platform/webhook.html).
Account availability, event coverage and delivery latency must be verified in
the pilot; this plan does not claim that a webhook is already configured.

Flow: email arrives, Zoho notifies an authenticated receiver, the receiver
durably queues the message reference, and the Ripley worker begins assessment.
Return promptly after durable acceptance; model work runs outside the webhook
request. Verify signatures using a secret provisioned through controlled setup.
Deduplicate notifications and serialize changes to the same request. Re-fetch
current mail through the trusted connector before deciding or acting. Minimize
payload content and retention, especially at the public receiver.

Test coverage for messages routed straight into folders, replies and messages
sent manually. Do not assume a new-mail event covers every change. A recovery
reconciliation checks for missed events, outages and disabled notifications;
scheduled due-date work still handles follow-ups. These support recovery and
deadlines while new incoming mail normally triggers work immediately.

Show “Listening for email” when the intake path is healthy, and the last verified
mailbox check separately. Track receipt-to-notification, notification-to-start
and start-to-prepared-action timings in the Scorecard. Measure median and p90;
immediate notification does not imply immediate completion or sending authority.

### 2 Understand the conversation and remember the work

Read incoming and sent messages together. Resolve the person and brand from
existing records and evidence. An unknown identity should not become a guessed
client link. Distinguish client requests, sales enquiries, vendor/business
work, information, personal mail and noise.

Create a request for each distinct job. One thread can contain several jobs;
related messages across threads may belong to the same job. Keep the evidence
links and allow correction of a bad grouping. A reply can answer one question
while leaving another open.

Each request needs a summary, owner, source evidence, next action, due date,
waiting party, follow-up date and completion evidence. Record explicit deadlines;
apply a documented default when none is given. Keep first reply time separate
from completion time.

Lifecycle: open, working, waiting on Tom, waiting on client/team, done. Track
answered time separately. New evidence can reopen a finished request. A thank-you
is not automatically a new request, and silence never proves completion.

**Ready when:** a reviewed set of real, historical conversations produces
explainable requests, correct owners and no missed requests in that review.
Include multi-part messages, sent replies, old open jobs and reopened threads.

### 3 Give Donna useful work she can finish

Implement a narrow set of actions first: file documents in the correct existing
location, apply approved sorting rules, link existing contacts/leads, prepare
complete reply drafts, and create or update the one owning work item.
Creating a new lead requires enough evidence of a genuine enquiry and a check
for an existing record. Route substantive client delivery or sales work to the
correct role and track the result back; assigning it does not finish it.

For each action, record intended work, source version, authority, attempt and
verified result. Check for an existing result before retrying. Never duplicate a
draft, lead or file because a worker timed out. An uncertain write is reconciled
before another attempt. Verify folder moves and retain undo information.

For drafts, include correct sender brand, recipients, thread, signature and
required attachments. Preserve deliberate human edits. Reassess drafts when a
new reply arrives; do not overwrite an edited draft silently.

**Ready when:** Donna can handle an incoming document, client question and new
enquiry end to end through the permitted actions, with evidence for every result.
Work outside supported capabilities stays owned, with an explicit next action.

### 4 Build the Donna page around decisions and results

Replace the Scanner name and findings-first presentation with the four views
above. Preserve existing links through redirects where practical. A request
opens to its conversation, prepared work, history and next action. Support
phone use and keyboard operation.

Ask Tom a question only when it changes the action. Show the full prepared
outbound message and a recommendation, not an empty compose box. Separate a
one-off decision from an explicit reusable rule, so “file this one” does not
silently authorize a rule for every sender. Rules are visible and reversible.

**Ready when:** Tom can understand and resolve the reviewed example decisions
without finding the source email elsewhere or re-explaining its history.
Coordinate the navigation edit with its current owner before touching AppShell.

### 5 Follow through without another reminder from Tom

Run new-mail intake and due follow-ups continuously. Prioritize client deadlines,
business risks and new sales enquiries over housekeeping. Existing standing
rules decide routine work; use model judgment for new or changed content, with
code enforcing allowed actions. Cache unchanged assessments.

When a reply arrives, reassess the request, cancel obsolete follow-ups and act
on the new information. Recheck the latest conversation immediately before any
outbound action. A prepared message is stale if its relevant source changed.
Missed promises, overdue work and failed actions stay visible and are escalated
with a recommended next step. Avoid repeated alerts for an unchanged issue.

**Ready when:** a waiting client, missed deadline, new prospect and temporary
mail outage all recover or escalate correctly, including across service restarts.
Routine work cannot starve urgent mail. Bound runtime and model spend per pass;
an exhausted budget leaves a visible backlog rather than silently dropping it.

### 6 Prove the benefit and roll out in stages

Start with historical replay, then a read-only live comparison against manual
review. Enable supported reversible actions next, then prepared replies and
follow-up work. Evaluate whole conversations, not just successful tool calls.
Use one action owner per mailbox throughout the transition. Keep a pause control
and a rollback path to the prior worker configuration.

Use meaningful checks for coverage, thread identity, duplicate prevention,
partial completion, sender protection, draft changes, retries, tenant isolation
and approval enforcement. Replay email content that tries to instruct Donna to
change her rules; messages and attachments are evidence, not authority.

Agree a representative review set and observation window before calling the
pilot complete. Review both ordinary mail and failures. Deploy or merge only
on Tom's instruction, as required by the scanner worktree brief.

**Ready when:** coverage is proven, reviewed work is correct, urgent items are
not missed in the pilot, and measured intervention is falling without hiding
work in the waiting or handled lists.

## Authority and trust

Donna should make routine decisions under standing rules. Do not ask Tom again
for each already-authorized reversible action. Complete the preparatory work
before escalating a decision.

Current outbound policy still requires the full draft and Tom's same-turn yes.
Building the approval screen does not grant automatic-send authority. Bind any
approval to the exact recipient list, content and attachments; invalidate it
after a relevant change. Wider sending authority would be a separate, explicit
decision after demonstrated reliability. Avoid designing a permanent requirement
for Tom to approve every routine filing or classification.

Money movement, contract changes, permanent deletion and client bookkeeping
entries remain outside Donna's email authority. Recognizing an invoice is not
permission to post it or pay it. Stored keep rules and protected senders take
precedence over spam judgments.

Keep full mail and attachments on Ripley under existing access controls. Store
only necessary work summaries, timing and source references in SWapp. Enforce
brand/tenant access at every read and action; ambiguous identity stays unresolved.
Completion requires evidence of the requested outcome. A missing finding, read
flag, saved draft or successful handoff alone cannot close a request.

## How we judge the result

Establish a manual-review baseline during the pilot. Suggested initial measures:

| Measure | Definition |
| --- | --- |
| Tom's time | Actual minutes spent reviewing and handling email per day |
| Decisions removed | Work completed under standing rules, plus decisions still escalated |
| Response speed | Business and elapsed time from incoming request to verified first reply |
| Resolution speed | Time from request to verified completion, with waiting time shown separately |
| Sales speed | Time from genuine enquiry to prepared next step and actual first response |
| Reliability | Missed requests, wrong filing, stale drafts, duplicate actions and failed follow-ups |
| Coverage | Last successful check, inspected backlog and any inaccessible folders or messages |
| Operating cost | Model/tool cost and worker time per handled request |

Do not claim hours saved from invented per-message estimates. Compare measured
effort with the baseline. Separate prepared replies from sent replies and sales
activity from actual sales outcomes. Existing email response targets stay in
place until explicitly changed; a five-minute detection target is not a promise
of a five-minute resolution. Feed verified events to the Scorecard after the
email lifecycle is reliable. Counts-only reporting can follow without delaying
the email desk.

### Scorecard email activity breakdown

Tom requested granular activity counts on the Scorecard, 2026-11-25. Add a
Donna / Email section with Today, This week and This month ranges, previous-period
comparison, and drill-through from each count to its supporting work records.
Keep a compact summary with an expandable action breakdown.

| Count | Breakdown |
| --- | --- |
| Emails reviewed | Unique messages Donna assessed; show new mail and historical backlog separately |
| Emails handled | Unique messages whose required email-processing actions are verified complete; show handled independently and handled with Tom's input separately |
| Marked as spam | Verified spam classifications/moves; distinguish suggestions awaiting a decision |
| Rescued from spam | Legitimate messages restored to the correct folder |
| Tagged | Unique messages tagged, plus counts for each tag and tag removals |
| Filed | Messages moved, broken down by destination such as Archive, Newsletter, Notification or Personal |
| Documents filed | Verified attachments saved and linked to the correct client/request |
| Replies prepared | Unique current reply drafts ready for review; revisions are not extra replies |
| Replies sent | Verified sends after the required approval, separate from prepared drafts |
| Requests tracked | New requests, answered requests, completed requests and reopened requests |
| Sales enquiries handled | Genuine enquiries linked or created, with their prepared and completed next steps |
| Follow-ups | Follow-ups prepared, actually sent, due and overdue |
| Needs Tom | Decisions and approvals still waiting, with age |
| Corrections and failures | Undo actions, corrected classifications, failed actions and unverified outcomes |

Instrument an action ledger from the first execution slice. Store stable message
and request references, logical action ID, action type, tag/folder where relevant,
actor, approval reference, event time, result and read-back evidence reference.
Retry attempts belong to the same action and cannot increase success counts.
Activity is counted when verified, not when proposed or when a command merely exits.
Record undo/correction events separately and expose them beside original actions.

Label whether a number counts messages, requests, drafts, attachments or actions.
For tags, show unique messages and distinct message/tag applications; for filing,
show unique messages and the verified move history. A message can be both tagged
and filed, so category counts do not add up to the unique emails-handled total.
Repeated review of unchanged mail is not another reviewed or handled email in
the same reporting period. Define transitions consistently for period comparisons.

Email handled means the email-processing work is finished; any substantive client
request it created can still be open. Spam cleared cannot count as a client request
completed. Derive email response/request statistics from the same canonical
events as the existing Scorecard to avoid counting an answer twice. On-camera
views show counts only; source drill-through remains staff-only.

## First build slice

Build the durable Zoho intake and request queue, then show a read-only Donna
view of the real outstanding work with source evidence and recommended next
actions. This proves Donna sees and understands the desk before she starts
changing it. Finish and review this slice before expanding her authority.

Technical starting points: `scripts/swapp_scan.py`, `scripts/swapp_scan_review.py`,
`scripts/swapp_scan_tools.py`, `src/lib/scanner/`, `src/lib/scan/`,
`src/app/(app)/scanner/`, `prisma/schema.prisma`, `docs/scan-sops/zoho.md`,
`docs/scorecard.md`, and Mailroom's existing mail tools and sorting rules.
