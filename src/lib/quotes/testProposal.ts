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
