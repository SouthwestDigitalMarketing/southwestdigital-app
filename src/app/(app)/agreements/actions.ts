"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
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
