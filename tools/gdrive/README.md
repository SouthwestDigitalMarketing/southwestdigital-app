# gdrive

Read-only Google Drive from the terminal: show or download the most recent
file. Moved here from the retired `mailroom-app` repo on 2026-11-28 (it had
only ever lived, uncommitted, in dalliance's checkout since 2026-11-02).

```
gdrive latest [--query "<Drive q clause>"]     # the newest file's details
gdrive get [--query ...] [--out DIR]           # download it
gdrive --setup-help                            # one-time Google Cloud steps
gdrive --authorize                             # one-time sign-in
```

It runs on **dalliance**, which holds the sign-in:
`~/.config/mailroom/drive-client-secret.json` and `drive-token.json`
(scope `drive.readonly`). Never commit either file.

## Install or update

On dalliance, from its SWapp checkout:

```
tools/gdrive/install.sh
```

Copies `origin/main:tools/gdrive` to `~/.local/share/swapp-gdrive`, builds the
venv `~/.local/share/swapp-gdrive-venv` from `requirements.txt` when that file
changes, and writes `~/.local/bin/gdrive`.
