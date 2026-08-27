# Southwest Digital App — Proposal Builder Handoff

## Current state

The offer builder has been updated through the Add-ons/Bonuses workflow. Additional options and bonuses are now managed in condensed, editable tables with drag handles, reorder support, centered controls, archive/delete actions, and explicit edit modes. The proposal preview uses the same ordering as the builder.

The Add-ons page now:

- Uses “Additional options” and “Bonuses” sections.
- Uses editable Service and Description columns.
- Uses Include, Price / mo, and Actions columns with consistent alignment.
- Supports adding, editing, reordering, archiving, restoring, and deleting rows.
- Vertically centers row content and keeps controls compact.
- Keeps a compact gap between an Add button and its table, with a larger gap between the two table sections.

The builder header now has:

- Save draft: writes the private working state to the draft Quote snapshot.
- Publish changes: writes a separate published snapshot and creates a stable public proposal URL.
- Exit: prompts when the builder has changed, with Continue editing, Exit without saving, and Save & exit.

## Publication boundary

Draft edits do not update the client-facing proposal. Publishing writes `publishedSnapshotJson`, `publishedAt`, and a random `publicToken` on `Quote`. The public route is `/proposal/[token]` and reads only the published snapshot. It is scoped to the active public Brand resolved from the request hostname.

The cover-letter page does not show a client link until the offer has been published. After publishing, it retrieves the stable public path from the server.

## Database/deployment requirement

Apply `prisma/migrations/20260826000000_add_quote_publication_snapshot/migration.sql` to the deployed database before using Publish changes in Vercel. The schema adds:

- `Quote.publishedSnapshotJson`
- `Quote.publicToken`
- `Quote.publishedAt`
- publication indexes

`prisma generate` hit a Windows query-engine rename/lock error in this workspace, but the Next production build and TypeScript check completed successfully.

## Validation

- `npm.cmd run typecheck` passes.
- `npm.cmd exec next build` passes, including `/proposal/[token]`.
- Targeted lint passes except for the pre-existing React lint warning/error in `OfferProposalPreview.tsx` where `setAgreementLoading(true)` is called synchronously inside an effect (around line 496). Do not treat that as caused by the publication work.

## Important existing architecture notes

- The project uses Brand as the only tenant boundary; published proposal lookup is filtered by the active Brand.
- Payment and agreement APIs currently use `engagementId`. The new Quote publication route is separate and currently renders the published proposal snapshot; wiring a newly published Quote directly to an Engagement/payment lifecycle may still be needed for production sending/signing.
- The existing `/offers/preview` route remains the staff/browser preview. The client-facing published route is `/proposal/[token]`.
- Do not expose provider secrets through `NEXT_PUBLIC_*` variables.

## Likely next work

1. Apply the new Prisma migration in the target Vercel database and deploy.
2. Test the complete flow with a real draft: edit → Save draft → verify the public URL is unchanged → Publish changes → verify the public URL reflects the published snapshot.
3. Confirm whether published Quote data should create/link an Engagement so the client can use the existing agreement, Stripe, and PayPal APIs from the public proposal.
4. Decide whether to rename or consolidate the old `/offers/preview` staff preview versus the new public route.
5. Clean up the existing `OfferProposalPreview` effect lint issue when convenient.

## Recent UI requests completed

Intro no longer shows the pricing calculator. Light-mode stepper states were inverted as requested. Add-on/bonus typography, tracking, header casing, checkbox sizing/cursors, handle borders/cursors, alignment, button spacing, row vertical alignment, and condensed layout were all adjusted in the builder files and `src/app/globals.css`.
