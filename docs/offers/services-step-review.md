# Services feature-branch review

Reviewed 2026-09-07 on `feature/services-step-redesign`, starting at `2e9f2b8`.

## Findings implemented

1. **High: treatment conversions could disappear on save.** Server materialization discarded included rows when the catalogue default remained optional. It also reset archived status and saved package defaults. Both editor and server now use the same pure reconciliation, retaining proposal-specific treatment, membership, prices and cadence.
2. **High: hybrid services never reached checkout.** Included services' add-on price and tier fields were not consumed by preview or checkout. The shared service resolver now supplies both consumers, excludes included tiers, and handles monthly versus one-time charges. The agreement route resolves names from both service collections.
3. **High: checkout ignored package restrictions.** The server accepted optional IDs outside the selected tier. It now resolves eligibility from the published snapshot and deduplicates add-on IDs and cleanup keys even when called without the request parser.
4. **High: reading saved tiers changed service scope.** A saved Maintain/Grow selection silently acquired Improve. Normalization now only validates, orders and deduplicates membership. The editor labels saved exceptions and requires an explicit range selection to change them.
5. **Medium: real fresh offers failed curated initialization.** The actual initial assessment contained placeholder selection keys, triggering the persisted-offer path. Those placeholders are removed; a persisted initialization marker also prevents intentionally empty offers from being repopulated by legacy fallbacks.
6. **Medium: the editor had no functional search or catalogue picker.** Assigned rows are shown by default, with search, explicit catalogue additions, and recovery of hidden/unassigned rows. Cadence and hybrid prices are editable. Treatment changes use one functional state update and preserve the prior price and cadence. Dead hidden circle controls are removed.
7. **Medium: public cards overstated inheritance.** Tier-specific support substitution contradicted “Everything included” copy. That statement now requires actual inclusion of every lower-tier recurring service; otherwise the full recurring list is shown. One-time inheritance is qualified separately.
8. **Medium: publication ignored real-estate tags.** Server materialization now reads active tags using the same rule as the editor.

Templates remain available for explicit loading and saving. The Services editor no longer allows asynchronous default-template loading to overwrite catalogue initialization or hydrated choices.

## Verification

- 63 test files / 415 tests pass, including 26 new regression tests.
- Existing seven saved-offer golden fixtures and their expected snapshots were not changed.
- Tests cover actual initial React assessment state, server save/publish reconciliation, tenant/product query scope, explicit empty selections, hidden rows, custom gaps, hybrid pricing with and without cleanup, duplicate selections, public/template round trips, and rendered editor/range markup.
- TypeScript passes.
- Focused ESLint passes with one existing `next/no-img-element` warning in the preview.
- Production `npx next build` passes. No schema changes required Prisma regeneration; the existing Windows DLL-lock issue in the `npm run build` wrapper is not addressed here.
- The existing lifecycle test emits a missing-`DATABASE_URL` diagnostic while exercising its fallback; the suite passes without loading live database credentials.

No database state, published offers, payments or outbound messages were changed. No push or deployment was performed.

## Remaining QA / opportunities

- No browser was connected to the Browser skill, so live interaction, mobile layout and keyboard-flow verification remain. Static rendering is not a substitute for those checks.
- On a disposable draft: confirm curated defaults; search/add a catalogue service; convert its treatment; set included and paid ranges; switch cadence; hide/show it; reload; then inspect the preview. Do not republish an accepted offer for testing.
- Longer-term: extract the broader pricing/selector layer from the large assessment and preview components. This review consolidates service rules without attempting that larger refactor.
- Existing published snapshots are not backfilled. Legacy services lacking a billing cadence retain their historical interpretation until explicitly edited and republished.
