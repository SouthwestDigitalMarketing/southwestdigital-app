# Terminal Zoho Mail agent

This repository includes a local, read-and-draft-only Zoho Mail CLI. It uses
the existing SWapp Zoho OAuth client by default and never exposes a send
command. A separate client can still be supplied with the optional
`ZOHO_MAIL_AGENT_CLIENT_ID` and `ZOHO_MAIL_AGENT_CLIENT_SECRET` variables.

## One-time Zoho setup

Open the existing `swapp` **Server-based Application** in the Zoho API Console
and add this exact additional redirect URI:

```
http://127.0.0.1:8765/callback
```

The CLI requests these scopes during consent:

```
ZohoMail.accounts.READ
ZohoMail.messages.READ
ZohoMail.messages.CREATE
ZohoMail.folders.READ
```

`ZohoMail.messages.CREATE` is required by Zoho for saving drafts, but Zoho also
uses it for sending. The CLI is intentionally limited to draft creation and
does not implement a send, update, archive, mark-read, move, label, or delete
operation.

The existing SWapp credentials in `.env.local` are used automatically. If you
want a separate terminal client instead, put its credentials in `.env.local`
without committing them:

```
ZOHO_MAIL_AGENT_CLIENT_ID=1000....
ZOHO_MAIL_AGENT_CLIENT_SECRET=....
```

The existing refresh token was authorized only for sending, so authorization
must be repeated once after adding the callback URI. This grants the terminal
credential the read scope; it does not change or delete the existing SWapp
connection record.

## Authorize and use

From the repository root:

```bash
npm run mail:agent -- auth
npm run mail:agent -- recent --limit 20 --json
npm run mail:agent -- show <message-id> --json
npm run mail:agent -- draft-reply <message-id> --body-file /path/to/reply.txt
```

The `auth` command opens the authorization URL when `xdg-open` is available;
the URL is also printed. The refresh token is stored in the desktop keyring
using `secret-tool`, with `pass` as a fallback. It is never written to the
repository or printed.

`recent` and `show` are read-only. `draft-reply` creates a Zoho draft threaded
to the original message using its `Message-ID` and `References` headers. It
does not send the draft.
