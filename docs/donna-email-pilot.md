# Donna email pilot

Donna's first build is an email desk. It inventories Zoho, reads full
conversations including Sent and Drafts, prepares recommendations and reply text,
and records verifiable work in SWapp. Reconcile jobs stay read-only. **Clean**
files allowlisted Inbox mail on Zoho on its own (Tom, 2026-11-25: check her
record afterwards, do not approve first), after a verified copy; each move is
recorded so it can be undone. New Inbox mail (IDLE push) queues a quiet
automatic Clean. An explicit preview job (`options.preview`) still moves
nothing, and a plan job files only what a preview listed. It drafts replies and never
sends. It does not use Trash, and it does not file known contacts or
client/sales mail. The broader build sequence is in
[the build plan](design/donna-email-build-plan.md).

**Steps (Tom, 2026-11-26; the default, `settings.steps`).** After inbox zero
archived client mail with no reasons, Donna works one step at a time with a gate
after each. **Step 1** (Overview → Start step 1, 10/25/50/100 emails; job options
`{preview, buckets, limit}`) reads Inbox and puts every email in a bucket with a
one-line reason; it moves nothing. Buckets come from code first: Mailroom's keep
rules → *Money and legal*; SWapp contacts with service records → *Clients*
(client name shown); other contacts → *People you know*; model `sales` → *Sales and
leads*; Mailroom sort rules (`~/projects/mailroom-app/config/mail-sort-rules.json`,
`DONNA_SORT_RULES`) → their folder; a written reply → *Needs a reply or decision*;
model `fileTo` → that folder; else *Not sure*. **Gate:** the step 1 page lists each
bucket with a choice (default *Leave in Inbox*, or Move to one of `STEP_FOLDERS`),
each email ticked, and a live line saying exactly what step 2 will move. **Step 2**
(`{previewJobId, plan:[{thread, folder}], buckets:true}`) moves only those, skips
anything changed since step 1, and reports each move with Undo. Both steps can be
stopped. In steps, nothing runs on its own: new-mail notify, heartbeat reconciles
and history passes are not queued, and `claimJob` hands out only Tom's steps and
undos. "On her own" in Limits restores the automatic behaviour. Inbox zero
(`archive_rest`) is removed.

**Sort, Choose, Do (Tom, 2026-11-26).** A stepped job is three steps shown by a
stepper on the job page: 1 Sort (Donna; the bucket sort job), 2 Choose (Tom; the
compact choice table, or "Close this job without changing anything", which sets
`options.closed`), 3 Do (Donna; the plan job with `buckets: true`). A finished sort
with no step 3 and not closed is Tom's turn (`sortAwaitsTom`): Current job opens it
and Completed jobs leaves it out. Completed jobs shows one row per job with step 3
folded into the outcome. The top bar reads "Step 1 of 3: Sort" / "Step 3 of 3: Do".

**Junk and Spam/Trash in every job (Tom, 2026-11-26).** Step 1 also asks the model
for `junk` (high/medium/low/no). An email goes in the **Junk** bucket (first on the
Choose table) only when junk is high or the sender is on Mailroom's always-spam list
(`~/.local/state/mailroom/spam-always-block.json`; those skip the model review),
and no guard applies: keep rules, SWapp contacts/clients, Mailroom's never-block list
(`config/spam-never-block.json`), a thread Tom replied in, money types, client/sales
category (`protected_reason`). Junk defaults: Spam + block sender (exact address onto
always-spam) for scam/pitch types, else Trash. Step 1 then sweeps Spam and Trash by
rules only: protected mail becomes **Rescue from Spam/Trash** (last bucket; Back to
Inbox, or Back to Inbox + never block), and the rest is snapshotted in
`empty_snapshot`. Step 3 rescues first, then junk actions, moves and tags, then, only
if Tom ticked the **Approve** box in step 2 (`options.empty`), permanently deletes the
snapshot (minus rescues) plus what the job moved to Spam/Trash; mail that arrived after
step 1 is never deleted unseen. Unsubscribe is not built.

**Step 4, Clean up (Tom, 2026-11-28).** Deleting moved out of Choose: approving the
deletion of 600+ Spam/Trash emails Tom never saw was backwards. Jobs are now Sort,
Choose, Do, Clean up. Step 1 also groups Spam (minus guarded mail, which is a rescue)
by sender (`cleanup_senders`) and asks the model for a verdict per sender, 25 per
review (`judge_senders`: block / keep / unsure), and counts Trash and Trash older
than 30 days (`report.cleanup`). After step 3 the job is Tom's turn again: the sort's
page shows one row per Spam sender (Block forever / Not spam: back to Inbox / Leave
in Spam, preset from the verdict) and one Trash row (leave / older than 30 days /
all). Start clean up creates a job `{previewJobId, cleanup, senders, trash,
approved}`: Not spam rescues that sender's Spam mail and adds them to never-block;
Block forever adds them to always-spam; only with the Approve tick does it delete
the blocked senders' snapshot mail and the chosen Trash. Senders left in Spam are
never deleted. "Skip clean up this time" sets `cleanupSkipped`. A job is Finished
only after step 4 (or a skip, or nothing to clean). Zoho filters are not created yet.

**Email types (Tom, 2026-11-26).** Step 1 gives each email a short type
(`EMAIL_TYPES` in the worker: People, Money, Systems, Marketing, Unwanted groups,
e.g. Quote, To pay, Phish, Pitch) with hover text and a group colour dot on the
Current job table. When nothing fits, the model invents a label (≤12 chars) with a
description; the worker keeps it in the local `email_types` table and offers it in
every later prompt. No approval: Tom reviews and asks for changes. A type's first
appearance is marked "new".

**Client tags (Tom, 2026-11-26).** Client mail gets a Zoho tag with the client's
name (no per-client folders) and is archived once addressed. Zoho IMAP takes no
custom keywords, so tags go through the Zoho Mail API using the mailbox owner's
SWapp email connection (`EmailConnection`, scopes now include
`ZohoMail.messages.READ`, `ZohoMail.messages.UPDATE`, `ZohoMail.tags.ALL`;
older grants show **Reconnect so Donna can tag mail** in Settings). Step 2
choices for a bucket with client names: *Tag with client name* or *Tag with
client name, then Archive*. The worker calls the `tag` op (lease-checked);
SWapp finds each email by sender and date, confirms its `Message-Id` header,
creates the tag if new and applies it (`src/lib/donna/tags.ts`). Tagging comes
first; an email that cannot be tagged is not moved. Only emails from SWapp
contacts with service records carry a client name. Tags have no Undo yet.

## Pages

- `/donna`: Overview is Donna's live status and controls: what she is doing
  now, last check-in, queue, Pause/Resume, Clean inbox now, Stop this clean,
  today's filed / need-you / review usage, recent actions, and Limits (reviews
  a day, background history on/off and cap, stored in `DonnaMailbox.settings`).
- `/donna/email`: mailbox status, Zoho default folders and custom folders with
  message counts, and the last Clean report. No request list or setup details.
  Work queues stay at `/donna/email/work`. A **Donna** button in the Donna
  chrome (every Donna view) opens Clean inbox, Empty spam, Clear
  notifications, Empty trash, Clean drafts, and Do it all, with folder
  counts; only Clean inbox is enabled. Tapping Clean inbox closes the modal
  and starts a clean. A light bar sits at the top of every app screen until
  a clean the operator started finishes (**Cleaning inbox**; **Checking
  inbox** for a preview); automatic cleans from new mail show no bar, with what it is on, n of total, a progress
  track, and an ETA once Donna is running. Queued jobs say **Waiting for
  Donna**; a paused mailbox says **Paused**. Tapping **Cleaning…** in the
  modal closes it. Tapping the bar opens `/donna/cleans/[id]`. Clean inbox
  is refused while the mailbox is paused.
- `/donna/email`: also lists **Filed by Donna**, the last five cleans that
  moved mail, each opening its list with Undo.
- `/donna/email/work`: two requests per page; Needs you, Working, Waiting and
  Handled are filters here, not top-level Donna tabs.
- `/donna/cleans/[id]`: one Inbox check or clean job. While it runs or waits:
  current item, n of total, progress, ETA and **Cancel**. A finished check
  lists **Donna would file**, every row ticked; **File the ticked emails**
  starts the real clean with exactly those conversations (the plan comes from
  the stored check, not the form). A finished clean lists each filed
  conversation with **Undo** (and **Undo all**); undone rows say Back in
  Inbox. Waiting, needs-you and left-in-Inbox lists follow. Each job keeps its
  own report in `DonnaJob.result`. This page shows that job’s own error, not
  leftover mailbox `lastError` from an earlier inventory.
- `/donna/requests/[id]`: Summary, Reply, Source and Activity views; separate
  direction and follow-up/completion views. Long content uses bounded readers.
- `/donna/settings`: Mailbox, Connection, Coverage and Rules, one view at a time.
- `/scorecard`: separate main menu item and compact hub.
- `/scorecard/email`: grouped email counts and two-item activity drill-down.
  Privacy mode shows counts only. Existing response-time reporting remains available.
- `/donna/activity` redirects to `/scorecard/email`; old `/donna?tab=...` links
  redirect to the matching email work queue. `/scanner` redirects to Donna and
  `/donna/legacy` retains earlier multi-source findings.

The high-level screens are checked above the fold at 360x640, 412x915 and
1280x800. All records are available through pagination and explicit detail views.

Only a platform operator in the Bookkeeping Conroe data scope can open the pilot.
Every new table has forced RLS, scoped through the mailbox's brand.

## Intake and recovery

Zoho outgoing mail webhooks POST to
`/api/donna/hooks/[brand]/[mailbox]/[key]`. An authenticated operator opens a
ten-minute enrollment window from Settings. Its 256-bit private URL is the
enrollment credential. The first signed POST's `x-hook-secret` is encrypted;
subsequent requests must pass HMAC SHA-256 verification with that enrolled key.
Renewing setup rotates the URL and discards the old secret. Keep the URL private.
The receiver verifies the original bytes, bounds the body size and stores no
email content from it. Acknowledge only after saving the deduplicated job.

Enrollment needs a public HTTPS endpoint reachable by Zoho. A Tailscale-only
development URL cannot receive Zoho's webhook. Signature handling and enrollment
were tested locally with synthetic signed requests; actual Zoho enrollment still
requires the deployment and account configuration.

On Python 3.14+, the daemon also opens one read-only IMAP IDLE connection to
INBOX. That push wakes the same durable queue. IDLE does not cover every folder:
the UI explicitly says it is listening to the inbox when no webhook is enrolled.
The worker claims saved queue jobs every two seconds; this does not check the
mailbox every two seconds. A fifteen-minute recovery reconciliation observes
missed pushes, changes in other folders and manually sent replies.

Mailbox locks serialize claims; jobs carry expiring, renewable leases. Publishing
and completion require the current lease. **Pause stops every job, Clean
included**: a paused mailbox is never claimed, and a running worker's next
heartbeat gets HTTP 409 and stops without reporting failure; the job stays
pending and continues on Resume. **Cancel** marks a Clean `cancelled`. A
queued one never runs. A running one keeps its lease: the next heartbeat
answers `cancelled: true`, the worker stops before its next move and reports
what it already filed; mail already filed stays filed and can be undone.
Failed work remains pending with exponential retry delay. A partial
reconcile pass queues its remaining backlog. Clean does not. Individual failed/oversized conversations are deferred for five minutes
without blocking other mail; ready and deferred counts stay in the coverage
report. Restarting never turns an incomplete queue into a successful result.

The native reader inventories all selectable folders and all UIDs. Reconcile
uses read-only SELECT and BODY.PEEK. A Clean check reviews every Inbox
conversation, even ones a read-only pass already assessed, and moves nothing;
its filing plan (thread, fingerprint, folder, assessment) is kept in the
worker's SQLite. An approved clean files only plan threads whose fingerprint is
unchanged since the check, with no new model review; changed, kept or
known-contact threads stay in Inbox with a reason. It uses a writable Inbox
select only to copy an allowlisted message and expunge the Inbox copy after the
destination copy is verified, and records each move (`clean_filed`). An `undo`
job copies those recorded messages back to Inbox, verifies, removes the filed
copy, and marks the conversation kept in Inbox so a later Clean leaves it. Trash is counted but not made into new requests;
unsent Drafts never count as sent answers. Raw mail stays in a private local
SQLite/cache directory on Ripley. Supported PDF and text attachments are read;
unsupported or oversized content remains an explicit request-level gap.

Mailroom's pull-only Maildir cache can supply existing full source messages, but
only when `.mbsyncstate` FarUidValidity matches the server and its far/near UID
mapping identifies the right local file. Maildir `U=` is the near UID and must
never be treated as the server UID. Missing files/mappings fall back to IMAP.
Server INTERNALDATE supplies arrival time; sender Date is only a fallback and
does not prove notification latency.

## Worker configuration

Server environment:

| Variable | Purpose |
| --- | --- |
| `DONNA_WORKER_TOKEN` | Dedicated random token, at least 32 characters |
| `DONNA_WORKER_USER_ID` | Actor for the authorized brand context |
| `DONNA_WORKER_BRAND` | Fixed worker brand slug; defaults to `bookkeeping-conroe` |
| `INTEGRATION_ENCRYPTION_KEY` | Existing integration encryption key; AUTH_SECRET fallback |

Worker environment in `~/.config/swapp-donna/env`, mode 600:

| Variable | Purpose |
| --- | --- |
| `DONNA_BASE_URL` | SWapp deployment URL |
| `DONNA_WORKER_TOKEN` | Same dedicated server token |
| `DONNA_REVIEW_MODEL` | Reviewer model; defaults to existing scanner default `gpt-6-luna` |
| `DONNA_STATE` | Private SQLite/raw-source directory; default `~/.local/state/swapp-donna` |
| `DONNA_MAILDIR` | Existing pull-only mail cache; default `~/Mail/zoho` |

Reuses `~/projects/mailroom-app/bin/mail` for its existing Zoho credentials. The
configured address must match that account. No new mail password is requested.
The reviewer runs without shell, apps, plugins, code mode or web search. Incoming
mail is evidence, not authority to change rules. No model output can send mail. Clean may file Inbox mail only through the
allowlisted, verified copy path, and only from a plan the operator approved.
A check reviews at most `--max-threads` conversations per pass within the daily
review budget; the rest show as not looked at yet.

Each pass assesses up to ten threads by default (`--max-threads`, 1–50).
`--daily-reviews` defaults to fifty model review attempts per UTC day, persisted
across restarts, including failed attempts. The limit leaves work pending with a
visible reason; it does not erase the backlog. Thread prompts are bounded and
reviewer calls time out after four minutes. Prioritize known clients and INBOX
work before other mail. Unchanged source and unchanged operator direction are
not reassessed. Saving an edited draft preserves it across source changes and
marks it stale for explicit review.

`scripts/systemd/swapp-donna.service` is an installation template. Copy the
reviewed standalone worker into `~/.local/share/swapp-donna/runtime/` before
installing it. Do not point a permanent service at a disposable Git worktree.
The service has not been installed or enabled by this build.

## Validation and local preview

The current preview is `http://100.98.89.93:3130/donna`, on the separate local
`swapp_donna` database. Development credentials and source caches are gitignored
or outside the repository. The app server unit is `swapp-donna-dev-3130`.
The Zoho pilot mailbox is paused. Only two real thread assessments were run;
complete backlog assessment is not claimed.

The following checks are available for developers:

```bash
npm run typecheck
npm run lint
npm test
python3 -m unittest discover -s scripts -p test_donna_worker.py
node --env-file=.env.development.local scripts/test_donna_integration.mjs
node --env-file=.env.development.local scripts/test_donna_ui.mjs
```

The last two require the isolated local database and dev server. They refuse a
different database, create labelled fixtures and remove them afterward. Pause
the actual pilot before running integration checks so only the test mailbox can
be claimed. Database checks cover signed enrollment, exact-byte signatures,
deduplication, exclusive leasing, replay safety, edited drafts, completion evidence,
backlog recovery, pause and tenant RLS using a non-superuser role.

No actual email was sent to test incoming delivery, and no public Zoho webhook
was configured. A short read-only IDLE subscription was accepted by the live account;
actual end-to-end arrival latency is still to be measured. Review the real
assessments before adding reversible execution or wider sending authority.
