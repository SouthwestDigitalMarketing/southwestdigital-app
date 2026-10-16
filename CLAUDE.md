# SWapp

**Read `README.md` first.** It is the entry point for this repository: product
context, tenant model, status, and the map of every other document.

**Then read `HANDOFF.md`** for current branch state and work in progress.
`README.md` describes the project; `HANDOFF.md` hands off the work. Keep them
separate.

Engineering rules are not stored in this repository. They live in the global
agent guidance at `~/.codex/AGENTS.md`, synchronized across machines. Read it
before starting work.

This file is a pointer so Claude Code has something to auto-read. Do not add
setup, status, or a second map here.

If you only read this file: never push without explicit user instruction, and
never run `prisma migrate deploy` or `prisma migrate dev` (see
`docs/deployment/database-migration-state.md`).
