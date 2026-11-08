"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { parseEmailOrThrow } from "@/lib/email";
import { withBrandDataTransaction } from "@/lib/tenancy/context";

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function leadId(formData: FormData) {
  const id = value(formData, "leadId");
  if (!id || id.length > 100) throw new Error("A valid lead ID is required.");
  return id;
}

function refreshLeadViews(id: string) {
  revalidatePath(`/leads/${encodeURIComponent(id)}`);
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/pipeline/[key]", "page");
}

export async function updateLeadAction(formData: FormData) {
  const { brand, dataContext } = await requireStaffBrandOrThrow();
  const id = leadId(formData);
  const name = value(formData, "name");
  const company = value(formData, "company");
  const email = parseEmailOrThrow(value(formData, "email"));
  const expectedServices = value(formData, "expectedServices");
  const notes = value(formData, "notes");
  const nextAction = value(formData, "nextAction");
  const nextDue = value(formData, "nextDue");
  const rawAmount = value(formData, "amount");
  const amount = rawAmount ? Number(rawAmount) : null;

  if (!name) throw new Error("Lead name is required.");
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 999999999999.99)) {
    throw new Error("Enter a valid amount of 0 or more.");
  }

  const current = await withBrandDataTransaction(dataContext, (transaction) =>
    transaction.meetingLead.findFirst({
      where: { id, brandId: brand.id, isActive: true },
      select: { id: true, pipeId: true },
    }),
  );
  if (!current) throw new Error("Lead not found for this brand.");

  await withBrandDataTransaction(dataContext, (transaction) =>
    transaction.meetingLead.update({
      where: { id: current.id },
      data: current.pipeId
        ? { expectedServices: expectedServices || null, notes: notes || null }
        : {
            name,
            company: company || null,
            email,
            expectedServices: expectedServices || null,
            notes: notes || null,
            nextAction: nextAction || null,
            nextDue: nextDue || null,
            amount,
            amountKind: amount === null ? null : value(formData, "amountKind") || null,
          },
      select: { id: true },
    }),
  );

  refreshLeadViews(id);
  redirect(`/leads/${encodeURIComponent(id)}?updated=1`);
}

export async function archiveLeadAction(formData: FormData) {
  const { brand, dataContext } = await requireStaffBrandOrThrow();
  const id = leadId(formData);
  const updated = await withBrandDataTransaction(dataContext, async (transaction) =>
    transaction.meetingLead.updateMany({
      where: { id, brandId: brand.id, isActive: true },
      data: { isActive: false },
    }),
  );
  if (updated.count !== 1) {
    const alreadyArchived = await withBrandDataTransaction(dataContext, (transaction) =>
      transaction.meetingLead.findFirst({
        where: { id, brandId: brand.id, isActive: false },
        select: { id: true },
      }),
    );
    if (!alreadyArchived) throw new Error("Lead not found for this brand.");
  }

  refreshLeadViews(id);
  redirect("/pipeline?view=archived&archived=1");
}

export async function restoreLeadAction(formData: FormData) {
  const { brand, dataContext } = await requireStaffBrandOrThrow();
  const id = leadId(formData);
  const updated = await withBrandDataTransaction(dataContext, async (transaction) =>
    transaction.meetingLead.updateMany({
      where: { id, brandId: brand.id, isActive: false },
      data: { isActive: true },
    }),
  );
  if (updated.count !== 1) throw new Error("Archived lead not found for this brand.");

  refreshLeadViews(id);
  redirect("/pipeline?view=archived&restored=1");
}
