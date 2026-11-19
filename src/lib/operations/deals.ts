import "server-only";

import { applyPipeTag } from "@/lib/pipe/tags";
import { PIPE_PROSPECTS_KEY } from "@/lib/pipe/deals";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

/**
 * A client won: move the contact's open Pipe Prospects deals to won (with the
 * payment and signature dates) and take `lead` off. Returns how many deals
 * moved. Used by client-won and by the service-records check.
 */
// Sales files one pipe-prospects row per Bookkeeping Conroe QuickBooks invoice
// (MeetingLead.amountKind = "invoice"). Those rows track receivables, not the
// sale, so they are never moved to won here or counted as a client's deals.
// amountKind is nullable and `not` alone would drop the nulls, hence the OR.
export const NOT_INVOICE_LEAD = {
  OR: [{ amountKind: null }, { amountKind: { not: "invoice" } }],
};

export async function markOpenDealsWon(input: {
  brandId: string;
  brandSlug: string;
  contactId: string;
  actorUserId: string;
  paidAt: Date | null;
  signedAt: Date | null;
}): Promise<number> {
  const context = createBrandDataContext({ brandId: input.brandId, actorUserId: input.actorUserId });
  const moved = await withBrandDataTransaction(context, async (tx) => {
    const pipeline = await tx.pipeline.findUnique({
      where: { brandId_key: { brandId: input.brandId, key: PIPE_PROSPECTS_KEY } },
      select: { id: true, stages: { select: { id: true, key: true } } },
    });
    const won = pipeline?.stages.find((s) => s.key === "won");
    if (!pipeline || !won) return 0;
    const open = await tx.pipelineItem.findMany({
      where: {
        pipelineId: pipeline.id,
        isActive: true,
        stage: { key: { notIn: ["won", "lost"] } },
        lead: { brandId: input.brandId, contacts: { some: { contactId: input.contactId } }, ...NOT_INVOICE_LEAD },
      },
      select: { id: true, leadId: true },
    });
    for (const item of open) {
      await tx.pipelineItem.update({ where: { id: item.id }, data: { stageId: won.id } });
      await tx.meetingLead.update({
        where: { id: item.leadId },
        data: {
          ...(input.paidAt ? { firstPaymentReceivedAt: input.paidAt } : {}),
          ...(input.signedAt ? { serviceAgreementSignedAt: input.signedAt } : {}),
        },
      });
    }
    return open.length;
  });
  await applyPipeTag({
    actorUserId: input.actorUserId,
    input: { brand: input.brandSlug, contactId: input.contactId, tag: "lead", action: "remove" },
  });
  return moved;
}
