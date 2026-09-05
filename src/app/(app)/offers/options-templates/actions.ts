"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { slugifyTagKey } from "@/lib/contacts/tags";
import {
  buildOptionsTemplateSnapshot,
  parseOptionsTemplateSnapshot,
  reconcileOptionsTemplateSnapshot,
  type OptionsTemplateAssessmentSlice,
  type OptionsTemplateSnapshot,
} from "@/lib/quotes/optionsTemplates";
import { buildDefaultBookkeepingSlice, ensureDefaultOptionsTemplate } from "@/lib/quotes/optionsTemplatesSeed";

const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;

type SessionInput = {
  userId?: string | null;
};

function parseNameDescription(input: { name: string; description?: string | null }) {
  const name = input.name.trim();
  const description = (input.description ?? "").trim();
  if (!name) throw new Error("Template name is required.");
  if (name.length > NAME_MAX) throw new Error(`Name must be ${NAME_MAX} characters or fewer.`);
  if (description.length > DESCRIPTION_MAX) {
    throw new Error(`Description must be ${DESCRIPTION_MAX} characters or fewer.`);
  }
  return { name, description: description || null };
}

function revalidateOptionsTemplatesPaths() {
  revalidatePath("/offers/options-templates");
  revalidatePath("/offers/add-ons");
}

async function getBrandCatalogOfferKeys(brandId: string): Promise<string[]> {
  const { proposalCatalog } = await getSchemaCapabilities();
  if (!proposalCatalog) return [];
  const services = await prisma.catalogService.findMany({
    where: { brandId, active: true },
    select: { code: true, name: true, offerKey: true },
  });
  return services
    .map((s) => s.offerKey ?? slugifyTagKey(s.code ?? s.name))
    .filter((key): key is string => Boolean(key));
}

function toClientTemplate(row: {
  id: string;
  name: string;
  description: string | null;
  productKind: string;
  defaultForProductKind: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    productKind: row.productKind,
    defaultForProductKind: row.defaultForProductKind,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type OptionsTemplateListItem = ReturnType<typeof toClientTemplate>;

export async function listOptionsTemplatesAction(includeArchived = false) {
  const { brand } = await requireStaffBrandOrThrow();
  await ensureDefaultOptionsTemplate(brand.id);
  const rows = await prisma.proposalOptionsTemplate.findMany({
    where: {
      brandId: brand.id,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      productKind: true,
      defaultForProductKind: true,
      archivedAt: true,
      updatedAt: true,
    },
  });
  return rows.map(toClientTemplate);
}

export async function getOptionsTemplateSnapshotAction(id: string): Promise<{
  slice: OptionsTemplateAssessmentSlice;
  skippedIds: string[];
} | null> {
  const { brand } = await requireStaffBrandOrThrow();
  const row = await prisma.proposalOptionsTemplate.findFirst({
    where: { id, brandId: brand.id },
    select: { snapshotJson: true },
  });
  if (!row) return null;
  const parsed = parseOptionsTemplateSnapshot(row.snapshotJson);
  if (!parsed) return null;
  const catalogKeys = await getBrandCatalogOfferKeys(brand.id);
  return reconcileOptionsTemplateSnapshot(parsed, catalogKeys);
}

export async function getDefaultOptionsTemplateSnapshotAction(
  productKind: "bookkeeping" = "bookkeeping",
): Promise<{
  templateId: string;
  templateName: string;
  slice: OptionsTemplateAssessmentSlice;
  skippedIds: string[];
} | null> {
  const { brand } = await requireStaffBrandOrThrow();
  await ensureDefaultOptionsTemplate(brand.id);
  const row = await prisma.proposalOptionsTemplate.findFirst({
    where: {
      brandId: brand.id,
      archivedAt: null,
      defaultForProductKind: productKind,
    },
    select: { id: true, name: true, snapshotJson: true },
  });
  if (!row) return null;
  const parsed = parseOptionsTemplateSnapshot(row.snapshotJson);
  if (!parsed) return null;
  const catalogKeys = await getBrandCatalogOfferKeys(brand.id);
  const { slice, skippedIds } = reconcileOptionsTemplateSnapshot(parsed, catalogKeys);
  return { templateId: row.id, templateName: row.name, slice, skippedIds };
}

export async function saveOptionsTemplateAction(input: {
  name: string;
  description?: string | null;
  makeDefault?: boolean;
  slice: OptionsTemplateAssessmentSlice;
  session?: SessionInput;
}) {
  const { brand } = await requireStaffBrandOrThrow();
  const { name, description } = parseNameDescription(input);
  const snapshot: OptionsTemplateSnapshot = buildOptionsTemplateSnapshot(input.slice);

  const created = await prisma.$transaction(async (tx) => {
    if (input.makeDefault) {
      await tx.proposalOptionsTemplate.updateMany({
        where: {
          brandId: brand.id,
          archivedAt: null,
          defaultForProductKind: "bookkeeping",
        },
        data: { defaultForProductKind: null },
      });
    }
    return tx.proposalOptionsTemplate.create({
      data: {
        brandId: brand.id,
        name,
        description,
        productKind: "bookkeeping",
        snapshotJson: snapshot as unknown as object,
        defaultForProductKind: input.makeDefault ? "bookkeeping" : null,
        createdById: input.session?.userId ?? null,
      },
      select: { id: true },
    });
  });
  revalidateOptionsTemplatesPaths();
  return created.id;
}

export async function createOptionsTemplateFromCatalogAction() {
  const { brand } = await requireStaffBrandOrThrow();
  const slice = await buildDefaultBookkeepingSlice(brand.id);
  const snapshot = buildOptionsTemplateSnapshot(slice);
  const created = await prisma.proposalOptionsTemplate.create({
    data: {
      brandId: brand.id,
      name: "New options template",
      description: null,
      productKind: "bookkeeping",
      snapshotJson: snapshot as unknown as object,
      defaultForProductKind: null,
    },
    select: { id: true },
  });
  revalidateOptionsTemplatesPaths();
  return created.id;
}

export async function updateOptionsTemplateAction(
  id: string,
  input: { name: string; description?: string | null },
) {
  const { brand } = await requireStaffBrandOrThrow();
  const data = parseNameDescription(input);
  const result = await prisma.proposalOptionsTemplate.updateMany({
    where: { id, brandId: brand.id },
    data,
  });
  if (result.count === 0) throw new Error("Options template not found.");
  revalidateOptionsTemplatesPaths();
}

export async function overwriteOptionsTemplateSnapshotAction(
  id: string,
  slice: OptionsTemplateAssessmentSlice,
) {
  const { brand } = await requireStaffBrandOrThrow();
  const snapshot = buildOptionsTemplateSnapshot(slice);
  const result = await prisma.proposalOptionsTemplate.updateMany({
    where: { id, brandId: brand.id, archivedAt: null },
    data: { snapshotJson: snapshot as unknown as object },
  });
  if (result.count === 0) throw new Error("Active options template not found.");
  revalidateOptionsTemplatesPaths();
}

export async function duplicateOptionsTemplateAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  const source = await prisma.proposalOptionsTemplate.findFirst({
    where: { id, brandId: brand.id },
    select: { name: true, description: true, snapshotJson: true, productKind: true },
  });
  if (!source) throw new Error("Options template not found.");
  const created = await prisma.proposalOptionsTemplate.create({
    data: {
      brandId: brand.id,
      name: `${source.name.slice(0, NAME_MAX - 7).trimEnd()} (copy)`,
      description: source.description,
      productKind: source.productKind,
      snapshotJson: source.snapshotJson as object,
      defaultForProductKind: null,
    },
    select: { id: true },
  });
  revalidateOptionsTemplatesPaths();
  return created.id;
}

export async function setDefaultOptionsTemplateAction(id: string, makeDefault: boolean) {
  const { brand } = await requireStaffBrandOrThrow();
  await prisma.$transaction(async (tx) => {
    const template = await tx.proposalOptionsTemplate.findFirst({
      where: { id, brandId: brand.id, archivedAt: null },
      select: { id: true },
    });
    if (!template) throw new Error("Active options template not found.");
    if (makeDefault) {
      await tx.proposalOptionsTemplate.updateMany({
        where: {
          brandId: brand.id,
          archivedAt: null,
          defaultForProductKind: "bookkeeping",
          NOT: { id: template.id },
        },
        data: { defaultForProductKind: null },
      });
      await tx.proposalOptionsTemplate.update({
        where: { id: template.id },
        data: { defaultForProductKind: "bookkeeping" },
      });
    } else {
      await tx.proposalOptionsTemplate.update({
        where: { id: template.id },
        data: { defaultForProductKind: null },
      });
    }
  });
  revalidateOptionsTemplatesPaths();
}

export async function archiveOptionsTemplateAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  const template = await prisma.proposalOptionsTemplate.findFirst({
    where: { id, brandId: brand.id },
    select: { defaultForProductKind: true },
  });
  if (!template) throw new Error("Options template not found.");
  if (template.defaultForProductKind) {
    throw new Error("Choose another default before archiving this template.");
  }
  await prisma.proposalOptionsTemplate.updateMany({
    where: { id, brandId: brand.id },
    data: { archivedAt: new Date() },
  });
  revalidateOptionsTemplatesPaths();
}

export async function restoreOptionsTemplateAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  const result = await prisma.proposalOptionsTemplate.updateMany({
    where: { id, brandId: brand.id },
    data: { archivedAt: null },
  });
  if (result.count === 0) throw new Error("Options template not found.");
  revalidateOptionsTemplatesPaths();
}

export async function deleteOptionsTemplateAction(id: string) {
  const { brand } = await requireStaffBrandOrThrow();
  const result = await prisma.proposalOptionsTemplate.deleteMany({
    where: {
      id,
      brandId: brand.id,
      archivedAt: { not: null },
      defaultForProductKind: null,
    },
  });
  if (result.count === 0) {
    throw new Error("Only archived, non-default templates can be deleted.");
  }
  revalidateOptionsTemplatesPaths();
}
