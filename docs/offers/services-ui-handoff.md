# Services UI implementation handoff

User approved implementing the UI recommendations, with limited remaining Codex allowance. Work in small local checkpoints. Starting point: `75b4f18`, already pushed to `origin/feature/services-step-redesign` at the user's request.

## Intended outcome

- Services × package comparison: Included, Optional with price/cadence, or Not offered.
- Compact rows grouped into recurring services and one-time work.
- Expand a service to edit this offer's included range, optional range, cadence, price and visibility; Apply/Cancel prevents partially saved edits.
- No Included/Add-on treatment switch: one service may be included in some tiers and optional in others.
- Service names open the offer editor. Shared catalogue editing is a secondary labeled action.
- Sidebar emphasizes coverage and distinguishes base prices from optional charges.
- Retain search, curated initialization, explicit catalogue additions, templates and recovery of hidden services.

## Implementation plan / status

1. Complete: pure read/apply configuration helpers preserve IDs, cadence, prices, hidden state, exact tier membership and existing included-service order.
2. Complete: grouped package comparison, expandable offer editor with Apply/Cancel, coverage sidebar, collapsed catalogue/template tools, and stacked package cells on narrow screens.
3. Complete: regression tests cover paid-to-hybrid edits, included-to-optional edits, visibility restoration, saved gaps, invalid prices and unchanged service order. Updated comparison rendering checks. Typecheck and focused lint pass; production build passes.
4. Complete: implementation committed locally under `Redesign services around package comparison and offer-specific editing`. No push performed for this phase.

## Continuation constraints

- Read AGENTS.md and HANDOFF.md together with private .local/COMPUTERS.md.
- Existing checkout/service resolver is the authority for eligibility and pricing. Do not change tier scope on reads, publish an offer, or migrate database data for UI testing.
- Browser discovery previously returned no connected browsers; do not claim live visual verification unless a connection becomes available.
- No push requested for this new implementation; the earlier push request was fulfilled.
- Keep this document current at checkpoints. If interrupted, inspect git status and latest commits before continuing.
## Entry points and behavior

- `src/app/(app)/offers/builder/ProposalAddOnsDemo.tsx`: comparison, picker, search, coverage, and state orchestration.
- `ServiceOfferEditor.tsx` beside it: local draft form and tier-range control. Apply saves all fields at once; Cancel discards edits.
- `proposalServiceConfiguration.ts` beside it: pure adapter for existing option/bonus storage. Simply opening a service does not convert it.
- The existing shared `src/lib/quotes/proposalServices.ts` still resolves paid eligibility. Checkout and publication were not changed in this UI phase.
- Adding a service follows the existing Add behavior, then opens its editor. Cancel discards subsequent settings edits, not the addition itself.
- Rename remains available as a secondary action in Package coverage. Base prices remain assessment-driven; including services does not automatically reprice packages.

## Verification and next-agent starting point

- Full suite: 64 files / 424 tests pass.
- TypeScript and focused ESLint pass. Production build passes.
- Existing golden fixtures were not updated.
- Browser discovery was retried and still returned an empty list. No live visual or interactive verification was possible.
- Next useful task: connect a browser and check desktop/laptop/mobile layouts, keyboard navigation, expansion and Apply/Cancel, Add services, hidden-service recovery and package renaming on a disposable draft.
- No required code work is knowingly left half-finished. Do not restart the redesign or change the saved tier model merely because visual QA is outstanding.
