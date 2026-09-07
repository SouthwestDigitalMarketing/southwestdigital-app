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

1. Planned: pure read/apply configuration helpers preserving saved IDs, cadence, prices, hidden state and exact tier membership.
2. Planned: expandable service editor and grouped comparison UI; coverage sidebar.
3. Planned: meaningful regression tests for saved configuration and comparison rendering; typecheck, focused lint and build.
4. Planned: update this handoff with actual results and remaining work, then commit locally.

## Continuation constraints

- Read AGENTS.md and HANDOFF.md together with private .local/COMPUTERS.md.
- Existing checkout/service resolver is the authority for eligibility and pricing. Do not change tier scope on reads, publish an offer, or migrate database data for UI testing.
- Browser discovery previously returned no connected browsers; do not claim live visual verification unless a connection becomes available.
- No push requested for this new implementation; the earlier push request was fulfilled.
- Keep this document current at checkpoints. If interrupted, inspect git status and latest commits before continuing.
