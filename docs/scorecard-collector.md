# Scorecard collector

`scripts/scorecard_collect.py` works out how fast we answer clients and posts
the timings to SWapp for `/scorecard`. The measures, rules and API are in
[`scorecard.md`](scorecard.md); this page covers running the collector.
Python 3 standard library only. Runs on **ripley** (the data lives there).

## Install (ripley)

```bash
cp scripts/systemd/swapp-scorecard.* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now swapp-scorecard.timer
```

The timer runs the oneshot service every 5 minutes (`OnCalendar=*:0/5`,
`Persistent=true`). The service runs
`~/projects/southwestdigital-app/scripts/scorecard_collect.py`. Logs:
`journalctl --user -u swapp-scorecard.service`.

First time, send all history once:

```bash
python3 scripts/scorecard_collect.py --dry-run --backfill   # look at the counts
python3 scripts/scorecard_collect.py --backfill             # then send
```

## Flags

| Flag | Meaning |
|---|---|
| (none) | Send events started in the last 14 days, plus every open (unanswered) one. Reads the last 90 days of mail. |
| `--backfill` | Send all history (all mail, all of `sales.db`). Safe to repeat: events upsert by `sourceKey`. |
| `--dry-run` | Post nothing. Print counts, answered counts and clock medians (minutes) per kind. No names, numbers or addresses. |
| `--source quo\|zoho\|all` | Which source to collect and post (default `all`). |
| `--clients-json PATH` | Read the client list (`ScorecardClient` rows) from a file instead of the API. With `--dry-run` no token is needed. |

Exit code 1 on an HTTP error from SWapp (the status is printed) or when the
Zoho read failed (a `zoho` sync with `ok: false` is still posted).

## What it reads

- **Clients**: `GET {SWAPP_BASE_URL}/api/scorecard/clients?brand=bookkeeping-conroe`
  with `Authorization: Bearer $SWAPP_OPERATIONS_TOKEN`. Both values come from
  `~/.config/swapp/operations.env` (`KEY=VALUE`), or from the environment.
- **Quo**: `~/.local/share/lochside-sales/sales.db`, opened with
  `file:...?mode=ro`. `messages` (direction, line, participants, status, time)
  and `calls` (`provider='quo'`). Phone numbers are normalised to E.164 and
  matched to client phones; the event's Chicago date must fall within the
  client's `clientFrom`..`clientUntil`. In-progress calls are skipped.
- **Zoho**: IMAP `imap.zoho.com:993` as `thomas@bookkeepingconroe.com`, password
  from `pass show zoho/imap-ripley` (first line). Folders INBOX, Archive,
  Personal (inbound) and Sent, each `SELECT`ed read-only; only
  `BODY.PEEK[HEADER.FIELDS (FROM TO CC DATE MESSAGE-ID IN-REPLY-TO REFERENCES
  AUTO-SUBMITTED PRECEDENCE LIST-UNSUBSCRIBE)]`, in UID chunks of 100. Nothing
  is marked read. The same Message-ID in several folders counts once.

## How events are built

- `text_reply` (`quo:text:<first incoming message id>`): a burst of incoming
  texts on one line counts once. Answered by the first outgoing text on that
  line with status `delivered`/`sent` that is not a bare "STOP", or an
  outgoing call on that line. Undelivered texts and "STOP" do not answer and
  do not end the burst.
- `call_answered` (`quo:call:<provider_id>`): incoming, completed, with
  `answered_at`.
- `call_missed` (`quo:call:<provider_id>`): incoming `no-answer`
  (`details.voicemail` when `duration > 0`); answered by the next outgoing call
  or answering text to that number on any line.
- `email_reply` (`zoho:email:<sha1(Message-ID)[:16]>`): a burst is the mail
  from one client between two Sent messages to that client; bulk mail
  (`List-Unsubscribe`, `Auto-Submitted` other than `no`, `Precedence`
  bulk/list/junk) and our own domains (`bookkeepingconroe.com`,
  `southwestdigital.io`, `realestatebookkeeper.com`) never count. Answer: a Sent
  message whose `In-Reply-To`/`References` names a burst message
  (`details.match="thread"`), else the first Sent to the client within 7 days
  (`"address"`). An answering Quo text or call to the client's number before
  that (or within 7 days when there is no email answer) wins, with
  `responseVia` `text`/`call`.
- Events go to `POST /api/scorecard/ingest` in batches of up to 500; the last
  batch per source carries `sync` (`quo` `coveredTo` = newest row in
  `sales.db`; `zoho` `coveredTo` = run time).

## Privacy

- Message bodies are never read into Python. The opt-out check runs inside
  SQLite (`upper(trim(body)) = 'STOP'`) and returns a 0/1 flag.
- Events carry timing, channel, contact id and a match method only. No names,
  numbers, addresses, subjects or Message-IDs (the email key is a hash).
- The token and IMAP password are never printed. `--dry-run` output has counts
  and medians only.
- It never sends a text, email or call.

## Tests

```bash
python3 -m unittest scripts/test_scorecard_collect.py
```

In-memory SQLite and fake header records; no network.
