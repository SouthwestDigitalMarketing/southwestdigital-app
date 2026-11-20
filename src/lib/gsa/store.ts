import "server-only";

import { prisma } from "@/lib/prisma";
import { readAcceptedPayment } from "@/lib/engagements/acceptedPayment";
import { withBrandDataTransaction, type BrandDataContext } from "@/lib/tenancy/context";
import { isTestEmail, readPaidProposal, type GsaDates, type GsaStep, type PaidProposal } from "./progress";

export type GsaProposal = GsaDates & {
  engagementId: string;
  clientName: string;
  contactId: string | null;
  leadId: string | null;
  gsaClientFolder: string | null;
  paid: PaidProposal;
};

const engagementSelect = {
  id: true,
  clientName: true,
  contactId: true,
  primaryContactEmail: true,
  onboardingData: true,
  gsaDraftedAt: true,
  gsaSentAt: true,
  gsaSignedAt: true,
  gsaClientFolder: true,
} as const;

type EngagementRow = {
  id: string;
  clientName: string;
  contactId: string | null;
  primaryContactEmail: string | null;
  onboardingData: unknown;
  gsaDraftedAt: Date | null;
  gsaSentAt: Date | null;
  gsaSignedAt: Date | null;
  gsaClientFolder: string | null;
};

/** Paid, live (not test), not voided or archived proposal agreements. */
const paidWhere = (brandId: string) => ({
  brandId,
  onboardingFeeStatus: "PAID" as const,
  agreementManagerStatus: { in: ["ACTIVE" as const, "CANCELLATION_REQUESTED" as const] },
});

async function leadIdsByContact(context: BrandDataContext, contactIds: string[]) {
  if (contactIds.length === 0) return new Map<string, string>();
  const links = await withBrandDataTransaction(context, (tx) =>
    tx.leadContact.findMany({
      where: { brandId: context.brandId, contactId: { in: contactIds }, lead: { isActive: true } },
      orderBy: { createdAt: "desc" },
      select: { contactId: true, leadId: true },
    }),
  );
  const byContact = new Map<string, string>();
  for (const link of links) if (!byContact.has(link.contactId)) byContact.set(link.contactId, link.leadId);
  return byContact;
}

function toProposal(row: EngagementRow, leads: Map<string, string>): GsaProposal {
  return {
    engagementId: row.id,
    clientName: row.clientName || "Unnamed client",
    contactId: row.contactId,
    leadId: row.contactId ? leads.get(row.contactId) ?? null : null,
    gsaClientFolder: row.gsaClientFolder,
    gsaDraftedAt: row.gsaDraftedAt,
    gsaSentAt: row.gsaSentAt,
    gsaSignedAt: row.gsaSignedAt,
    paid: readPaidProposal(row.onboardingData),
  };
}

function live(row: EngagementRow) {
  return readAcceptedPayment(row.onboardingData)?.isTestProposal !== true && !isTestEmail(row.primaryContactEmail);
}

/** Every paid proposal agreement whose GSA is not signed yet, longest waiting first. */
export async function paidAwaitingGsa(context: BrandDataContext): Promise<GsaProposal[]> {
  const rows = (await prisma.engagement.findMany({
    where: { ...paidWhere(context.brandId), gsaSignedAt: null },
    select: engagementSelect,
  })).filter(live);
  const leads = await leadIdsByContact(context, rows.flatMap((row) => row.contactId ? [row.contactId] : []));
  return rows
    .map((row) => toProposal(row, leads))
    .sort((a, b) => (a.paid.paidAt?.getTime() ?? 0) - (b.paid.paidAt?.getTime() ?? 0));
}

/** Paid proposal agreements for these contacts (a contact page, or a lead's linked contacts). */
export async function paidProposalsForContacts(context: BrandDataContext, contactIds: string[]): Promise<GsaProposal[]> {
  if (contactIds.length === 0) return [];
  const rows = (await prisma.engagement.findMany({
    where: { ...paidWhere(context.brandId), contactId: { in: contactIds } },
    orderBy: { signedAt: "desc" },
    select: engagementSelect,
  })).filter(live);
  const leads = await leadIdsByContact(context, contactIds);
  return rows.map((row) => toProposal(row, leads));
}

const STEP_FIELD = { drafted: "gsaDraftedAt", sent: "gsaSentAt", signed: "gsaSignedAt" } as const;

export class GsaError extends Error {}

/**
 * Marks a GSA step done (at the given time) or clears it. Marking it signed
 * also fills the linked leads' "Service agreement signed" and "Initial payment
 * received" dates where they are still empty.
 */
export async function setGsaStep(
  context: BrandDataContext,
  input: { engagementId: string; step: GsaStep; done: boolean; at?: Date; folder?: string | null },
) {
  const engagement = await prisma.engagement.findFirst({
    where: { ...paidWhere(context.brandId), id: input.engagementId },
    select: { id: true, contactId: true, onboardingData: true },
  });
  if (!engagement) throw new GsaError("No paid proposal agreement with that id.");
  const at = input.at ?? new Date();
  const data: Record<string, Date | string | null> = { [STEP_FIELD[input.step]]: input.done ? at : null };
  if (input.folder !== undefined) data.gsaClientFolder = input.folder;
  await prisma.engagement.update({ where: { id: engagement.id }, data });

  if (input.step === "signed" && input.done && engagement.contactId) {
    const paidAt = readPaidProposal(engagement.onboardingData).paidAt;
    const contactId = engagement.contactId;
    await withBrandDataTransaction(context, async (tx) => {
      const links = await tx.leadContact.findMany({
        where: { brandId: context.brandId, contactId },
        select: { leadId: true },
      });
      const leadIds = links.map((link) => link.leadId);
      if (leadIds.length === 0) return;
      await tx.meetingLead.updateMany({
        where: { brandId: context.brandId, id: { in: leadIds }, serviceAgreementSignedAt: null },
        data: { serviceAgreementSignedAt: at },
      });
      if (paidAt) {
        await tx.meetingLead.updateMany({
          where: { brandId: context.brandId, id: { in: leadIds }, firstPaymentReceivedAt: null },
          data: { firstPaymentReceivedAt: paidAt },
        });
      }
    });
  }
}
