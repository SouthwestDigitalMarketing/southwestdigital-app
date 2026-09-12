# Southwest Digital App engineering rules

This repository contains the multi-brand application operated by Southwest Digital Marketing. The product is called **SWapp**.

**This file is the single entry point.** Read it first; it routes you everywhere else.

## Where everything lives

Each document has one job and one update cadence. Do not merge them.

| Read this | To learn | Changes |
|---|---|---|
| **`AGENTS.md`** (this file) | The rules you may not break, and where everything is | Rarely |
| **`docs/SWAPP-BRIEF.md`** | What the product and business are, who it serves, how it makes money | When the product changes |
| **`docs/SWAPP-REVIEW-AND-ROADMAP.md`** | Priorities, launch blockers, phase gates, success measures | Quarterly |
| **`docs/IMPLEMENTATION-STATUS.md`** | Progress against those gates | As gates close |
| **`HANDOFF.md`** | Branch state, work in progress, health baseline, first commands | Every session |

Reference material, read when the task touches it:

| Topic | Document |
|---|---|
| Architecture, auth, tenancy, data ownership, offboarding, theming | `docs/architecture/` |
| Offer/product kinds and how to add one | `docs/architecture/product-kinds.md` |
| Keyboard layer — **required** before touching anything keyboard-related | `docs/keyboard/README.md` |
| Environment variables | `docs/deployment/environment-variables.md` |
| Migration drift and safe Prisma commands | `docs/deployment/database-migration-state.md` |
| Deployment, database roles, production identity, cutover | `docs/deployment/` |
| Zoho mailbox setup | `docs/email-connections/zoho-setup.md` |
| Offer builder and options templates | `docs/offers/` |
| Unbuilt design intent (work items, proposal versioning) | `docs/design/` |
| Session history through 2026-09-08, for provenance only | `docs/handoff-archive/` |

`README.md` is the public-facing description of the repository. `CLAUDE.md`
points here.

## Push policy

**Settled 2026-09-12.** Agents take work as far as a reviewable pull request.
The owner merges.

The **lead agent** (the Claude session in the main checkout) may:

- commit locally, at every phase boundary, so work survives an interruption;
- push any branch, including straight to `main` for documentation-only commits;
- open pull requests.

The lead agent **does not merge**, and does not push code to `main` outside a
pull request. A merge deploys production for an application that bills clients,
and it is the one step in the chain that is expensive to undo. Pushing a branch
and opening a PR deploy nothing, so there is no reason to gate them.

Before asking for a merge, the lead agent must have run `npm run typecheck`,
`npm run lint` and `npm test`, and must say in the PR what they returned —
including the pre-existing failure count, so a baseline failure is never
mistaken for a new one. It must also say what is **not** covered: this repo has
no DOM test harness, so component and overlay behaviour reaches production
unverified unless a Playwright spec covers it.

**Sub-agents on the contributor tiers** (the opencode spark team) keep the
narrower grant: their own `spark/<ticket>` branch and a pull request, nothing
else. Their models carry training rights on prompts and cannot run the suite
against a database. Their `.opencode/opencode.json` enforces this as capability
rather than instruction; changing that file is an owner decision.

Nobody force-pushes, and nobody rewrites published history.

No destructive migration, outbound client message, or payment transaction may be
initiated from any agent session.

## Handing commands to the owner

Tom works **without a mouse** and cannot highlight and copy text out of an agent
response. Whenever a reply asks him to run something in a terminal, write it to
`~/go`, make it executable, and tell him to type `~/go`. Always show the command
in the reply too.

```bash
printf '%s\n' '#!/usr/bin/env bash' \
  "printf '%s\n' 'Running: npm test'" \
  'npm test' > ~/go && chmod +x ~/go
```

**Every executable handoff must print the exact command immediately before it
runs.** Showing it only in the agent reply is not enough: Tom must be able to see
in the target terminal what he just executed. This applies both to `~/go` and to
anything copied to the clipboard for execution in another terminal.

Also put the command on the clipboard as a second route when possible. The
clipboard payload must be a self-reporting one-liner, not the bare command:

```bash
printf '%s' "printf '%s\\n' 'Running: npm test' && npm test" | clip
```

`~/.local/bin/clip` wraps `wl-copy` and adds no trailing newline, so the paste
waits at the prompt instead of executing. Say that it is on the clipboard. One
job per handoff — chain related steps with `&&` rather than handing over a block
he has to split by hand.

Never stage a destructive command without saying plainly what it does. When
nothing is staged, leave `~/go` as a harmless `echo`; a one-shot command should
reset `~/go` after its real work returns (using an exit trap if appropriate), so
stale execution is safe without truncating the script before it runs.

Over SSH this copies to the *remote* machine's clipboard; `clip` detects that,
warns, and exits 2. If it does, say so rather than letting him paste nothing.

The full rule, which applies to every project, is in `~/.claude/CLAUDE.md`.

### Remote Omarchy shutdown over SSH

For Dalliance, the local account is `thomas`; `ssh dalliance` defaults to
Ripley's `tom` and is the wrong target. Use the explicit account and force a
local terminal for the password prompt:

```bash
ssh -tt -o PreferredAuthentications=password -o PubkeyAuthentication=no \
  thomas@dalliance 'omarchy system shutdown' </dev/tty
```

When handing this over through `~/go`, print the command first and clear the
one-shot script **after** SSH returns. Overwriting `$0` before the command runs
can truncate the script while Bash is still reading it, causing only the
`Running:` line to appear and no SSH attempt at all.

The remote command may print a `jq` error about
`HYPRLAND_INSTANCE_SIGNATURE` because an SSH session has no Hyprland GUI;
that warning is harmless if SSH returns status `0`. Confirm the result from
Ripley with `tailscale ping dalliance` and `tailscale status`: successful
shutdown is shown as ping timeouts and the peer marked `offline`.

### Pixel video-transfer troubleshooting

Do not interrupt a valuable in-progress phone transfer merely to benchmark a
different connection. In the September 2026 Pixel 9 incident, the observed
`5.1 MB/s` while resuming with `rsync --append-verify` was largely the speed of
re-reading and verifying the existing partial prefix; it was not a clean test
of resumed write speed. Leave the current transfer alone unless the owner asks
to stop it. Test optimizations next time with a separate small copy (or a fresh
transfer), compare MTP/GVFS against ADB, and record the negotiated USB mode,
cable, source method, destination filesystem, and measured rate before changing
the production workflow.

## Machines and agent workspaces

Development runs on **ripley** (Omarchy/Arch). Agent panes live in the `herdr`
session `swapp`; the Next dev server runs in its `dev` tab so it outlives any
SSH connection. The owner reaches all of this from **dalliance** (laptop) or
**steelbreeze** (Omarchy, always-on agent host) over Tailscale SSH, with
`localhost:3000` forwarded to the browser.

| Path | What it is |
|---|---|
| `~/Projects/southwestdigital-app` | Main checkout. Holds `.env.local` with live Stripe, PayPal, Cloudflare, Google and Zoho secrets, plus the Supabase `DATABASE_URL`. |
| `~/Projects/swapp-spark` | Git worktree used by the agent team. **Contains no `.env.local` by design.** |

Rules that follow from that split:

- Agents on models with training rights on prompts (the cheap contributor tiers)
  run **only** in the worktree, never in the main checkout, and never read
  `.env*`, `/mnt`, or the database.
- `npm run typecheck`, `npm run lint` and `npm test` all pass in the worktree
  without secrets. If a task needs secrets or the database, it is owner work,
  not agent work.
- `.local/` is Git-ignored, private, and must never be committed or quoted into
  a commit message, PR, or public document.

## Non-negotiable architecture rules

- `Brand` is the only tenant level. Do not introduce an organization or client-account layer without an approved architecture decision.
- A user has one global identity and gains access through explicit `BrandMembership` records.
- Every record containing tenant-owned business data must have a required `brandId`, a foreign key to `Brand`, and an appropriate brand-leading index.
- Resolve the entry brand from a database-backed `BrandDomain`; do not add hard-coded production hostname maps.
- Treat the active brand as request/session context. Never authorize access merely because a brand identifier was supplied by the browser.
- Platform roles and brand roles are separate. A brand administrator is not a platform administrator.
- Integration credentials are brand-specific, encrypted at rest, and server-only. Never expose secrets through `NEXT_PUBLIC_*` variables.
- Do not send authenticated portal activity or sensitive client data to advertising platforms by default.
- Never run a destructive production migration without a backup, rehearsal, reconciliation report, and rollback plan.

## Framework guidance

This project uses Next.js 16. Read the relevant local guide in `node_modules/next/dist/docs/` before using framework APIs or conventions that may have changed.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
