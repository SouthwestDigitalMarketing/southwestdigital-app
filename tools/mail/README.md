# Mail tools

Terminal tools for Tom's Zoho mailbox and calendar, moved here from the retired
`mailroom-app` repo on 2026-11-28. They run on ripley, where the credentials
live; other machines' `mail` commands forward to ripley over ssh (made by
`machine-setup`).

| Command | What it does |
|---|---|
| `mail` | Read, search, draft, move and unsubscribe in the Zoho mailbox. Never sends without `--yes`. Donna's worker (`scripts/donna_worker.py`) loads it as a library. |
| `zoho-html-draft` | Saves an HTML draft in Tom's font and signature. |
| `text` | Sends one text through Quo; shows the envelope and refuses without `--yes`. |
| `calendar`, `cal` | Zoho Calendar in the terminal; `cal add` makes an appointment. |
| `calendar-notify` | The reminder service (1 hour and 10 minutes before). |
| `mail-retain` | Daily: moves Payments mail older than 2 months to Trash (`config/folder-retention.json`). |

Only Donna moves mail now. Mailroom's spam patrol, spam sweep, mail-sort, the
`scan` reviews and its web page were retired, not moved.

## Install or update (ripley)

```
tools/mail/install.sh
```

Copies `origin/main:tools/mail` to `~/.local/share/swapp-mail`, writes the
commands in `~/.local/bin`, and installs `calendar-notify.service` and
`mail-retain.timer`. Run it again after a merge that changes these files.

## Where things live

- Account settings: `~/.config/mailroom/accounts.json` (passwords come from `pass`).
- Tom's lists, which Donna adds to: `~/.config/mailroom/spam-never-block.json`
  and `mail-sort-rules.json` (seeded from `config/` on first install, then
  never overwritten). Always-spam: `~/.local/state/mailroom/spam-always-block.json`.
- State (message ids, unsubscribe log, reminders sent): `~/.local/state/mailroom/`.
- Calendar libraries: the venv at `~/.local/share/mailroom-calendar/venv`
  (`pip install -r requirements-calendar.txt`).

The `mailroom` directory names are kept so nothing on disk had to move.

## Tests

```
~/.local/share/mailroom-calendar/venv/bin/python -m unittest discover -s tools/mail/tests
```
