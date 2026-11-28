/** The accepted offer remains a record, even after later status changes. */
export type QuoteFreezeState = {
  status?: string | null;
  signedAt?: Date | string | null;
  onboardingFeeStatus?: string | null;
  onboardingData?: unknown;
  engagement?: QuoteFreezeState | null;
};

export function isQuoteFrozen(value: QuoteFreezeState | null | undefined): boolean {
  if (!value) return false;
  const data = value.onboardingData;
  const acceptance = data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>).proposalAcceptance : null;
  return ["accepted", "signed", "paid"].includes(value.status?.toLowerCase() ?? "")
    || Boolean(value.signedAt)
    || value.onboardingFeeStatus === "PAID"
    || Boolean(acceptance && typeof acceptance === "object")
    || isQuoteFrozen(value.engagement);
}

export const quoteFreezeSelect = {
  status: true,
  engagement: { select: { status: true, signedAt: true, onboardingFeeStatus: true, onboardingData: true } },
} as const;

export function assertQuoteNotFrozen(value: QuoteFreezeState) {
  if (isQuoteFrozen(value)) throw new Error("Accepted, signed or paid offers are frozen.");
}
