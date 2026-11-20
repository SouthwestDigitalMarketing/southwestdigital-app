/**
 * GSA (General Services Agreement) progress after a proposal agreement is paid.
 * Until the GSA is signed the client is still a lead (Tom, 2026-11-20), so a
 * paid proposal with no signed GSA is the hottest lead in the firm.
 */

export const GSA_STEPS = ["drafted", "sent", "signed"] as const;
export type GsaStep = (typeof GSA_STEPS)[number];

export const GSA_STEP_LABELS: Record<GsaStep, string> = {
  drafted: "Drafted",
  sent: "Sent",
  signed: "Signed",
};

/** The process promises the GSA within 24 hours of payment. */
export const GSA_DUE_HOURS = 24;

export type GsaDates = {
  gsaDraftedAt: Date | null;
  gsaSentAt: Date | null;
  gsaSignedAt: Date | null;
};

export type PaidProposal = {
  amount: number | null;
  currency: string;
  paidAt: Date | null;
  tier: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Amount, date and tier of the paid proposal agreement, from Engagement.onboardingData. */
export function readPaidProposal(onboardingData: unknown): PaidProposal {
  const data = isRecord(onboardingData) ? onboardingData : {};
  const acceptance = isRecord(data.proposalAcceptance) ? data.proposalAcceptance : {};
  const payment = isRecord(acceptance.payment) ? acceptance.payment : {};
  const builder = isRecord(data.proposalBuilderState) ? data.proposalBuilderState : {};
  const services = isRecord(builder.services) ? builder.services : {};
  const paidAt = typeof payment.paidAt === "string" ? new Date(payment.paidAt) : null;
  return {
    amount: typeof payment.amount === "number" && Number.isFinite(payment.amount) ? payment.amount : null,
    currency: typeof payment.currency === "string" && payment.currency ? payment.currency.toUpperCase() : "USD",
    paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
    tier: typeof services.tierLabel === "string" && services.tierLabel.trim() ? services.tierLabel.trim() : null,
  };
}

/** The furthest step reached, or null when nothing has been done yet. */
export function currentGsaStep(dates: GsaDates): GsaStep | null {
  if (dates.gsaSignedAt) return "signed";
  if (dates.gsaSentAt) return "sent";
  if (dates.gsaDraftedAt) return "drafted";
  return null;
}

/** What has to happen next, in plain words. */
export function nextGsaAction(dates: GsaDates): string {
  switch (currentGsaStep(dates)) {
    case null:
      return "Draft the GSA from the proposal (Kassad), then Tom approves it.";
    case "drafted":
      return "Send the GSA for signature (Donna, on Tom's yes).";
    case "sent":
      return "Get the GSA signed.";
    default:
      return "GSA signed. The client is won.";
  }
}

/** Whole hours since payment; 0 when the payment date is unknown or in the future. */
export function hoursSincePaid(paidAt: Date | null, now: Date): number {
  if (!paidAt) return 0;
  return Math.max(0, Math.floor((now.getTime() - paidAt.getTime()) / 3_600_000));
}

/** "6h" under two days, otherwise "3d". */
export function formatWaiting(hours: number): string {
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/**
 * Folder names on ripley (~/projects/clients/<folder>) to try for this client's
 * agreement PDFs: the saved folder first, then the company slug with and
 * without a trailing entity word ("Rodan Properties LLC" -> rodan-properties).
 */
export function gsaFolderCandidates(savedFolder: string | null, company: string): string[] {
  const full = slug(company);
  const bare = full.replace(/-(llc|inc|pllc|pc|corp|co|ltd|lp)$/, "");
  return [...new Set([savedFolder ?? "", full, bare].filter(Boolean))];
}
