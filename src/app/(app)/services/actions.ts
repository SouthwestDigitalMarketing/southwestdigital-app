"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { tagMarksRealEstate } from "@/lib/quotes/catalog";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePriority(raw: string) {
  if (!raw) return 500;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error("Priority must be a number.");
  return Math.max(0, Math.round(parsed));
}

function revalidateServicePaths() {
  revalidatePath("/services");
  revalidatePath("/tags");
  revalidatePath("/offers/included");
  revalidatePath("/offers/add-ons");
}

async function serviceForBrand(id: string, brandId: string) {
  const service = await prisma.catalogService.findFirst({
    where: { id, brandId },
    select: { id: true, _count: { select: { packageServices: true } } },
  });
  if (!service) throw new Error("Service not found.");
  return service;
}

async function readServiceFields(formData: FormData, brandId: string) {
  const name = clean(formData.get("name"));
  const code = clean(formData.get("code")) || null;
  const cardLabel = clean(formData.get("cardLabel")) || null;
  const clientBenefit = clean(formData.get("clientBenefit")) || null;
  const internalDescription = clean(formData.get("internalDescription")) || null;
  const defaultInclusion = clean(formData.get("defaultInclusion")) || null;
  const priority = parsePriority(clean(formData.get("priority")));
  const tagIds = [...new Set(formData.getAll("tagIds").filter((value): value is string => typeof value === "string" && value.trim().length > 0))];

  if (!name) throw new Error("Name is required.");

  const tags = tagIds.length
    ? await prisma.contactTag.findMany({
        where: { id: { in: tagIds }, brandId, isActive: true },
        select: { id: true, key: true, label: true, kind: true },
      })
    : [];
  if (tags.length !== tagIds.length) throw new Error("One or more tags are not available.");

  const industry = tags.find((tag) => tag.kind === "INDUSTRY");
  const product = tags.find((tag) => tag.kind === "PRODUCT_LEAD");

  return {
    fields: {
      name,
      category: industry?.label ?? product?.label ?? tags[0]?.label ?? "general",
      service: product?.key ?? tags[0]?.key ?? "cleanup",
      tagId: product?.id ?? tags[0]?.id ?? null,
      code,
      cardLabel,
      clientBenefit,
      internalDescription,
      defaultInclusion,
      realEstateSpecific: tags.some((tag) => tagMarksRealEstate(tag)),
      priority,
    },
    tagIds: tags.map((tag) => tag.id),
  };
}

export async function listCatalogRealEstateMarkersAction() {
  const { brand } = await requireStaffBrandOrThrow();
  return prisma.catalogService.findMany({
    where: { brandId: brand.id, active: true },
    select: { id: true, name: true, code: true, realEstateSpecific: true },
  });
}

export async function createCatalogServiceAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const { fields, tagIds } = await readServiceFields(formData, brand.id);

  if (fields.code) {
    const existing = await prisma.catalogService.findFirst({
      where: { brandId: brand.id, code: fields.code },
      select: { id: true },
    });
    if (existing) throw new Error("A service with that code already exists.");
  }

  await prisma.catalogService.create({
    data: {
      brandId: brand.id,
      ...fields,
      tags: {
        create: tagIds.map((tagId) => ({ brandId: brand.id, tagId })),
      },
    },
  });
  revalidateServicePaths();
}

export async function updateCatalogServiceAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const id = clean(formData.get("id"));
  if (!id) throw new Error("Service id is required.");
  await serviceForBrand(id, brand.id);
  const { fields, tagIds } = await readServiceFields(formData, brand.id);

  if (fields.code) {
    const existing = await prisma.catalogService.findFirst({
      where: { brandId: brand.id, code: fields.code, NOT: { id } },
      select: { id: true },
    });
    if (existing) throw new Error("A service with that code already exists.");
  }

  await prisma.$transaction([
    prisma.catalogServiceTag.deleteMany({ where: { serviceId: id, brandId: brand.id } }),
    prisma.catalogService.update({ where: { id }, data: fields }),
    ...tagIds.map((tagId) =>
      prisma.catalogServiceTag.create({
        data: { brandId: brand.id, serviceId: id, tagId },
      }),
    ),
  ]);
  revalidateServicePaths();
}

export async function setCatalogServicesForTagAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const tagId = clean(formData.get("tagId"));
  const serviceIds = [...new Set(formData.getAll("serviceIds").filter((value): value is string => typeof value === "string" && value.trim().length > 0))];
  if (!tagId) throw new Error("Tag is required.");

  const tag = await prisma.contactTag.findFirst({
    where: { id: tagId, brandId: brand.id, isActive: true },
    select: { id: true, key: true, label: true, kind: true },
  });
  if (!tag) throw new Error("Tag not found.");

  const selectedServices = serviceIds.length
    ? await prisma.catalogService.findMany({
        where: { id: { in: serviceIds }, brandId: brand.id },
        select: { id: true },
      })
    : [];
  if (selectedServices.length !== serviceIds.length) throw new Error("One or more services are not available.");

  const currentLinks = await prisma.catalogServiceTag.findMany({
    where: { brandId: brand.id, tagId },
    select: { serviceId: true },
  });
  const affectedServiceIds = [...new Set([...serviceIds, ...currentLinks.map((link) => link.serviceId)])];
  const selectedServiceIds = new Set(serviceIds);

  const affectedServices = affectedServiceIds.length
    ? await prisma.catalogService.findMany({
        where: { id: { in: affectedServiceIds }, brandId: brand.id },
        select: {
          id: true,
          tags: { select: { tag: { select: { id: true, key: true, label: true, kind: true } } } },
        },
      })
    : [];

  const updates = affectedServices.map((service) => {
    const tags = service.tags.map((link) => link.tag).filter((assigned) => assigned.id !== tagId);
    if (selectedServiceIds.has(service.id)) tags.push(tag);
    const industry = tags.find((assigned) => assigned.kind === "INDUSTRY");
    const product = tags.find((assigned) => assigned.kind === "PRODUCT_LEAD");
    return {
      id: service.id,
      category: industry?.label ?? product?.label ?? tags[0]?.label ?? "general",
      service: product?.key ?? tags[0]?.key ?? "cleanup",
      tagId: product?.id ?? tags[0]?.id ?? null,
      realEstateSpecific: tags.some((assigned) => tagMarksRealEstate(assigned)),
    };
  });

  await prisma.$transaction([
    prisma.catalogServiceTag.deleteMany({ where: { brandId: brand.id, tagId } }),
    ...updates.map((update) =>
      prisma.catalogService.update({
        where: { id: update.id },
        data: {
          category: update.category,
          service: update.service,
          tagId: update.tagId,
          realEstateSpecific: update.realEstateSpecific,
        },
      }),
    ),
    ...serviceIds.map((serviceId) =>
      prisma.catalogServiceTag.create({
        data: { brandId: brand.id, serviceId, tagId },
      }),
    ),
  ]);

  revalidateServicePaths();
}

export async function setCatalogServiceActiveAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const id = clean(formData.get("id"));
  const active = clean(formData.get("active")) === "true";
  if (!id) throw new Error("Service id is required.");
  await serviceForBrand(id, brand.id);
  await prisma.catalogService.update({
    where: { id },
    data: { active },
  });
  revalidateServicePaths();
}

export async function deleteCatalogServiceAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const id = clean(formData.get("id"));
  if (!id) throw new Error("Service id is required.");
  const service = await serviceForBrand(id, brand.id);
  if (service._count.packageServices > 0) {
    throw new Error("This service is used on a package. Archive it instead of deleting.");
  }
  await prisma.catalogService.delete({ where: { id } });
  revalidateServicePaths();
}
