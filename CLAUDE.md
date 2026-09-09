# SWapp

**Read `AGENTS.md` first.** It holds the non-negotiable engineering rules and
the map of every other document in this repository.

This file used to duplicate setup and status information and drifted badly out
of date. It is now a pointer, so there is only one place to keep current.

| You want | Read |
|---|---|
| The rules, and where everything lives | `AGENTS.md` |
| What the product and business are | `docs/SWAPP-BRIEF.md` |
| Priorities and launch blockers | `docs/SWAPP-REVIEW-AND-ROADMAP.md` |
| Current branch state and work in progress | `HANDOFF.md` |
| Local setup, dev login, checks, scripts | `docs/local-development.md` |

Two rules that are worth repeating here, because they are the expensive ones to
get wrong:

- **Never push without explicit user instruction.** Commit locally; leave the
  push to the user.
- **Never run `prisma migrate deploy` or `prisma migrate dev`.** The migration
  history is divergent from the schema — see
  `docs/deployment/database-migration-state.md`.
