# Donna email pilot

Donna's first build is a read-only email desk. It inventories Zoho, reads full
conversations including Sent and Drafts, prepares recommendations and reply text,
and records verifiable work in SWapp. It does not move, tag, delete, send or write
CRM/bookkeeping records. The broader build sequence is in
[the build plan](design/donna-email-build-plan.md).

## Pages

- `/donna`: Overview with a short status and one Email card.
- `/donna/email`: mailbox status and each folder’s message count. No request list
  or setup details. Work queues stay at `/donna/email/work`.
- `/donna/email/work`: two requests per page; Needs you, Working, Waiting and
  Handled are filters here, not top-level Donna tabs.
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
and completion require the current lease and an unpaused mailbox. Failed work
remains pending with exponential retry delay. A partial pass queues its remaining
backlog. Individual failed/oversized conversations are deferred for five minutes
without blocking other mail; ready and deferred counts stay in the coverage
report. Restarting never turns an incomplete queue into a successful result.

The native reader inventories all selectable folders and all UIDs. It uses
read-only SELECT and BODY.PEEK. Trash is counted but not made into new requests;
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
mail is evidence, not authority to change rules. No model output has an execution
path for mailbox writes or sending in this pilot.

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
