import "server-only";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/quo";
import { getQuoSmsCredentials } from "@/lib/reviews/quoCredentials";

export type ProposalAlertKind = "signed" | "paid" | "processing" | "failed";

const HEADLINES: Record<ProposalAlertKind, string> = {
  signed: "Proposal signed",
  paid: "Deposit PAID",
  processing: "Bank payment started (clears in ~4 business days)",
  failed: "Payment FAILED - deposit still unpaid",
};

function money(amount: number | null | undefined, currency = "USD") {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
}

export function proposalAlertText(input: {
  kind: ProposalAlertKind;
  clientName: string;
  company?: string | null;
  amount?: number | null;
  currency?: string;
  detail?: string | null;
  isTest?: boolean;
}) {
  const who = [input.clientName, input.company].filter((part) => part && part.trim()).join(", ") || "Unknown client";
  const amount = money(input.amount, input.currency);
  return [
    `${input.isTest ? "[TEST] " : ""}SWapp: ${HEADLINES[input.kind]}`,
    who,
    amount,
    input.detail,
  ].filter(Boolean).join("\n");
}

/**
 * Texts the staff alert phone (STAFF_ALERT_PHONE) from the brand's Quo line.
 * Never throws: an alert must not change the outcome of a signing or payment.
 */
export async function sendProposalAlert(
  engagementId: string,
  brandId: string,
  alert: { kind: ProposalAlertKind; amount?: number | null; currency?: string; detail?: string | null },
): Promise<boolean> {
  const to = process.env.STAFF_ALERT_PHONE?.trim();
  if (!to) {
    console.warn("[staff-alert] STAFF_ALERT_PHONE not set; alert skipped", { engagementId, kind: alert.kind });
    return false;
  }
  try {
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, brandId },
      select: { clientName: true, clientLegalName: true, signerName: true, isTestProposal: true },
    });
    if (!engagement) return false;
    const text = proposalAlertText({
      ...alert,
      clientName: engagement.signerName || engagement.clientName,
      company: engagement.clientLegalName || (engagement.signerName ? engagement.clientName : null),
      isTest: engagement.isTestProposal,
    });
    await sendSms(to, text, await getQuoSmsCredentials(brandId));
    return true;
  } catch (error) {
    console.error("[staff-alert] alert failed", { engagementId, kind: alert.kind, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
