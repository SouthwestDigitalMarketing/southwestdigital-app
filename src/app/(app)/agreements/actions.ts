"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE } from "@/lib/agreements/template";

type AgreementTemplateInput = {
  name: string;
  description: string;
  content: string;
};

function parseTemplateInput(input: AgreementTemplateInput) {
  const name = input.name.trim();
  const description = input.description.trim();
  const content = input.content.trim();
  if (!name) throw new Error("Template name is required.");
  if (name.length > 120) throw new Error("Template name must be 120 characters or fewer.");
  if (description.length > 500) throw new Error("Description must be 500 characters or fewer.");
  if (!content) throw new Error("Agreement text is required.");
  if (content.length > 100_000) throw new Error("Agreement text is too long.");
  return { name, description: description || null, content };
}

function revalidateAgreementPaths() {
  revalidatePath("/agreements");
  revalidatePath("/offers/intro");
}

function agreementRecordWhere(id: string, brandId: string) {
  return {
    id,
    brandId,
    OR: [
      { agreementText: { not: null } },
      { agreementSentAt: { not: null } },
      { signedAt: { not: null } },
    ],
  };
}

export async function voidAgreementAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  const result = await prisma.engagement.updateMany({
    where: { ...agreementRecordWhere(id, brand.id), signedAt: null, agreementManagerStatus: "ACTIVE" },
    data: { agreementManagerStatus: "VOIDED_BEFORE_SIGNATURE" },
  });
  if (result.count === 0) throw new Error("Only unsigned active agreements can be voided immediately.");
  revalidateAgreementPaths();
}

export async function requestAgreementCancellationAction(id: string, reason: string) {
  const { brand, session } = await requireStaffBrandOrThrow();
  const cleanedReason = reason.trim();
  if (cleanedReason.length > 1_000) throw new Error("Cancellation reason must be 1,000 characters or fewer.");
  const cancellationToken = randomBytes(32).toString("base64url");
  const cancellationTokenHash = createHash("sha256").update(cancellationToken).digest("hex");
  const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const recipient = await prisma.engagement.findFirst({
    where: { ...agreementRecordWhere(id, brand.id), signedAt: { not: null }, agreementManagerStatus: { in: ["ACTIVE", "CANCELLATION_REQUESTED"] } },
    select: { primaryContactEmail: true, billingContactEmail: true, clientName: true, signerName: true },
  });
  const email = recipient?.billingContactEmail ?? recipient?.primaryContactEmail;
  if (!recipient || !email) throw new Error("This agreement does not have a signer email address.");
  const result = await prisma.engagement.updateMany({
    where: { ...agreementRecordWhere(id, brand.id), signedAt: { not: null }, agreementManagerStatus: { in: ["ACTIVE", "CANCELLATION_REQUESTED"] } },
    data: {
      agreementManagerStatus: "CANCELLATION_REQUESTED",
      agreementCancellationRequestedAt: new Date(),
      agreementCancellationRequestedByUserId: session.user.id,
      agreementCancellationReason: cleanedReason || null,
      agreementCancellationTokenHash: cancellationTokenHash,
      agreementCancellationTokenExpiresAt: tokenExpiresAt,
    },
  });
  if (result.count === 0) throw new Error("Only signed active agreements can have cancellation requested.");
  const baseUrl = (process.env.PLATFORM_BASE_URL ?? "").replace(/\/$/, "");
  if (!baseUrl || !process.env.AUTH_RESEND_KEY || !process.env.AUTH_EMAIL_FROM) {
    throw new Error("Email delivery is not configured for cancellation notices.");
  }
  const link = `${baseUrl}/agreement-cancellation/${cancellationToken}`;
  const safeClientName = recipient.clientName.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const safeReason = cleanedReason.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: email,
      subject: "Action required: agreement cancellation request",
      text: `A cancellation request has been made for ${recipient.clientName}. Review and acknowledge it here: ${link}`,
      html: `<p>Hello ${recipient.signerName ?? "there"},</p><p>A cancellation request has been made for the signed agreement for <strong>${safeClientName}</strong>.</p>${safeReason ? `<p>Reason: ${safeReason}</p>` : ""}<p><a href="${link}">Review and acknowledge the cancellation request</a></p><p>This link expires in 30 days.</p>`,
    }),
  });
  if (!response.ok) throw new Error("Cancellation request was recorded, but the notification email could not be sent.");
  revalidateAgreementPaths();
}

export async function archiveAgreementAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  const result = await prisma.engagement.updateMany({
    where: agreementRecordWhere(id, brand.id),
    data: { agreementManagerStatus: "ARCHIVED" },
  });
  if (result.count === 0) throw new Error("Agreement not found.");
  revalidateAgreementPaths();
}

export async function deleteAgreementAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  const result = await prisma.engagement.deleteMany({
    where: agreementRecordWhere(id, brand.id),
  });
  if (result.count === 0) throw new Error("Agreement not found.");
  revalidateAgreementPaths();
}

export async function batchAgreementAction(
  ids: string[],
  action: "void" | "requestCancellation" | "archive" | "delete",
  reason = "",
) {
  const { brand } = await requireStaffBrandOrThrow();
  const uniqueIds = [...new Set(ids.filter((id) => id.trim()))];
  if (uniqueIds.length === 0) throw new Error("Select at least one agreement.");
  if (action === "requestCancellation") {
    for (const id of uniqueIds) await requestAgreementCancellationAction(id, reason);
    return;
  }

  const where = {
    id: { in: uniqueIds },
    brandId: brand.id,
    OR: [
      { agreementText: { not: null } },
      { agreementSentAt: { not: null } },
      { signedAt: { not: null } },
    ],
  };

  if (action === "delete") {
    await prisma.engagement.deleteMany({ where });
  } else {
    await prisma.engagement.updateMany({
      where: {
        ...where,
        agreementManagerStatus: "ACTIVE",
        ...(action === "void" ? { signedAt: null } : {}),
      },
      data: { agreementManagerStatus: action === "void" ? "VOIDED_BEFORE_SIGNATURE" : "ARCHIVED" },
    });
  }

  revalidateAgreementPaths();
}

export async function createAgreementTemplateAction() {
  const { brand } = await requireStaffBrandOrThrow();
  const created = await prisma.agreementTemplate.create({
    data: {
      brandId: brand.id,
      key: `agreement-${randomUUID()}`,
      name: "New agreement template",
      description: null,
      content: DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
      status: "active",
      isDefault: false,
    },
    select: { id: true },
  });
  revalidateAgreementPaths();
  return created.id;
}

export async function updateAgreementTemplateAction(
  id: string,
  input: AgreementTemplateInput,
) {
  const { brand } = await requireStaffBrandOrThrow();
  const data = parseTemplateInput(input);
  const result = await prisma.agreementTemplate.updateMany({
    where: { id, brandId: brand.id },
    data,
  });
  if (result.count === 0) throw new Error("Agreement template not found.");
  revalidateAgreementPaths();
}

export async function setDefaultAgreementTemplateAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  await prisma.$transaction(async (transaction) => {
    const template = await transaction.agreementTemplate.findFirst({
      where: { id, brandId: brand.id, status: "active" },
      select: { id: true },
    });
    if (!template) throw new Error("Active agreement template not found.");
    await transaction.agreementTemplate.updateMany({
      where: { brandId: brand.id, isDefault: true },
      data: { isDefault: false },
    });
    await transaction.agreementTemplate.update({
      where: { id: template.id },
      data: { isDefault: true },
    });
  });
  revalidateAgreementPaths();
}

export async function archiveAgreementTemplateAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  const template = await prisma.agreementTemplate.findFirst({
    where: { id, brandId: brand.id },
    select: { isDefault: true },
  });
  if (!template) throw new Error("Agreement template not found.");
  if (template.isDefault) throw new Error("Choose another default before archiving this template.");
  await prisma.agreementTemplate.updateMany({
    where: { id, brandId: brand.id },
    data: { status: "archived", archivedAt: new Date(), isDefault: false },
  });
  revalidateAgreementPaths();
}

export async function restoreAgreementTemplateAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  const result = await prisma.agreementTemplate.updateMany({
    where: { id, brandId: brand.id },
    data: { status: "active", archivedAt: null },
  });
  if (result.count === 0) throw new Error("Agreement template not found.");
  revalidateAgreementPaths();
}

export async function deleteAgreementTemplateAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  const result = await prisma.agreementTemplate.deleteMany({
    where: { id, brandId: brand.id, status: "archived", isDefault: false },
  });
  if (result.count === 0) {
    throw new Error("Only archived, non-default templates can be deleted.");
  }
  revalidateAgreementPaths();
}
