# RLS gate-1 worker report — revision 1

Date: 2026-10-21 (America/Chicago)
Repo: `~/projects/worktrees/swapp-gate1`
Branch: `crew/rls-gate1`
Base/head: `e40149cb5f99b2c830b28c4344fb6e503bfec` (no code changes; docs only)

## What was asked

Repeatable full replay of all migrations on scratch Postgres only. No
application code changes; docs plus scratch verification only.

## What was done

1. Read `jobs/rls/worker-m3-r1.md` (worktree copy), the team `jobs/rls/sweep.md`
   and `jobs/rls/review-m3-r1.md`. Confirmed the M3 finding: replay from empty
   passes files #1–#13, fails at #14 (`catalog_services` never created).
2. Count correction: the brief says 40 migrations, but this branch holds
   **41** migration SQL files (M3's 40 plus `20261021120000_pipe_lead_step`
   from the leads merge; `migration_lock.toml` is not a migration). All 41
   were replayed.
3. Reproduced the M3 failure on a fresh scratch DB (docker `postgres:17.5`,
   image ID `sha256:aadf2c0696f5ef357aa7a68da995137f0cf17de06ae5e1f17de06ae5c769b302`,
   `127.0.0.1:54329` only): files #1–#13 pass, #14 fails with
   `relation "catalog_services" does not exist`. Identical to M3.
4. Static scan of all migration SQL (ALTER/ADD CONSTRAINT/CREATE INDEX
   targets, REFERENCES targets, INSERT/UPDATE targets vs CREATE TABLEs):
   9 relations are referenced but never created in the chain.
5. Confirmed each gap empirically in 10 staged replays (S0–S9): fresh DB +
   cumulative stubs, replay until stop. Each stage failed with the predicted
   missing-relation error (see `jobs/rls/gate1-baseline.md` failure catalog).
6. Wrote the consolidated baseline:
   - `jobs/rls/gate1-baseline.sql` — 9 stub tables (columns verbatim from
     offline `prisma migrate diff` DDL), 10 pre-created enums, 3 UNIQUE
     constraints required by #17's ON CONFLICTs, no FKs (targets don't exist
     yet at baseline time). Plain-ADD columns omitted so later migrations
     still apply.
   - `jobs/rls/gate1-baseline.md` — repeatable chain, per-gap evidence,
     full 41-file pass log, and what is still not claimed.
7. Final verification on a fresh empty DB with the committed files:
   baseline + files #1–#41, `ON_ERROR_STOP=1` throughout — **41/41 pass,
   exit 0**; 36 public tables afterward (27 chain + 9 stubs). Baseline
   re-run verified idempotent (exit 0, skips only).
8. Teardown: scratch container stopped/removed, port 54329 free, scratch
   passwords (mode-0600 /tmp) and helpers removed. `uncleinvoice-app-db-1`
   on 5433 untouched.

## Failure catalog (summary)

`catalog_services` (#14) → `contact_tags` (#15 FK) → `contact_tag_links`
(#17) → `contact_tag_automations` (#17) → `quotes` (#17 FK) → `BrandMedia`
(#19) → `Engagement` (#23 FK) → `"CatalogService"` ghost table (#38, likely
casing bug — exists nowhere, stubbed for replay only) → `MeetingLead` (#40).

## Baseline approach

Minimal stubs for exactly the missing relations, typed per schema.prisma,
minus columns that later migrations add with plain ADD COLUMN. Documented
inline per table. No migration or application file touched.

## Replay result

- Staged confirmation: 9/9 gaps fail-then-pass as predicted.
- Final: baseline + 41/41 migration files, exit 0, `ON_ERROR_STOP=1`.
- Still open (not claimed): baseline≠production fingerprint, #38 casing bug
  unfixed by design, `migrate deploy` lineage still divergent, all other
  M3-review gates untouched.

## Files changed (docs only, committed locally, no push)

- `jobs/rls/gate1-baseline.sql` (new)
- `jobs/rls/gate1-baseline.md` (new)
- `jobs/rls/worker-gate1-r1.md` (this report)

## Rules observed

No push/PR/merge/deploy; no prod, remote DB, or env files; no board CLI;
no outbound contact. Scratch Postgres only; secrets in mode-0600 /tmp,
removed at teardown.
