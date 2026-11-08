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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
