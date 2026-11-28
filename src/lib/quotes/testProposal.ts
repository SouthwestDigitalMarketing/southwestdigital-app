import type { Prisma } from "@prisma/client";

/** Spec 08: a quote is a test proposal when its snapshot says so or its
 *  engagement row says so. Test proposals stay viewable and signable, but
 *  they are hidden from staff lists/counts by default and can never be paid
 *  for real. No migration: both signals already exist. */
export function snapshotIsTestProposal(snapshotJson: unknown): boolean {
  return (
    !!snapshotJson &&
    typeof snapshotJson === "object" &&
    !Array.isArray(snapshotJson) &&
    (snapshotJson as Record<string, unknown>).isTestProposal === true
  );
}

export function quoteIsTestProposal(quote: {
  snapshotJson?: unknown;
  engagement?: { isTestProposal?: boolean } | null;
}): boolean {
  return snapshotIsTestProposal(quote.snapshotJson) || quote.engagement?.isTestProposal === true;
}

/**
 * Positive, null-safe DB matcher for test proposals (Spec 08 fix round 2).
 * Every arm is a positive match, so rows with a missing snapshot path or a
 * missing engagement are simply not counted — never wrongly included or
 * excluded. A null-safe *exclusion* (`NOT test`) is not expressible with
 * Prisma JSON path filters on Postgres (a comparison against a missing path
 * yields NULL, which filters the row out either way), so lists count tests
 * with this matcher and over-fetch by that count instead of excluding in
 * the DB. `take: 50 + testCount` then guarantees 50 real rows after the
 * in-memory `quoteIsTestProposal` filter.
 */
export function testProposalMatchWhere(): Prisma.QuoteWhereInput {
  return {
    OR: [
      { snapshotJson: { path: ["isTestProposal"], equals: true } },
      { engagement: { isTestProposal: true } },
    ],
  };
}

/** Rows to fetch so the post-filter still yields `pageSize` real offers. */
export function realProposalTake(testCount: number, pageSize = 50): number {
  return pageSize + Math.max(0, testCount);
}
