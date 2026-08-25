"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { BrandStatus, ContactTagKind } from "@prisma/client";
import { applyTagPipelineAutomation } from "@/lib/contacts/automation";
import { slugifyTagKey } from "@/lib/contacts/tags";
import { parseSubmittedPhone } from "@/lib/phone";
import { parseEmailOrThrow } from "@/lib/email";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseEmail(value: FormDataEntryValue | null) {
  return parseEmailOrThrow(typeof value === "string" ? value : "");
}

function parsePhone(value: FormDataEntryValue | null) {
  return parseSubmittedPhone(typeof value === "string" ? value : "");
}

function ids(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function revalidateTagPaths(contactId?: string) {
  revalidatePath("/contacts");
  revalidatePath("/settings");
  revalidatePath("/settings/tags");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
}

function parseKind(raw: string): ContactTagKind {
  if (
    raw === ContactTagKind.PRODUCT_LEAD ||
    raw === ContactTagKind.CLIENT_LEAD ||
    raw === ContactTagKind.INDUSTRY
  ) {
    return raw;
  }
  return ContactTagKind.CUSTOM;
}

export async function createContactAction(formData: FormData) {
  const { brand, isPlatformOperator } = await requireStaffBrandOrThrow();
  const firstName = clean(formData.get("firstName"));
  const lastName = clean(formData.get("lastName"));
  if (!firstName || !lastName) throw new Error("First and last name are required.");

  const name = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  const email = parseEmail(formData.get("email"));
  const company = clean(formData.get("company")) || null;
  const roleTitle = clean(formData.get("roleTitle")) || null;
  const notes = clean(formData.get("notes")) || null;
  const phoneE164 = parsePhone(formData.get("phone"));
  const tagIds = ids(formData, "tagIds");
  const clientIds = ids(formData, "clientIds");
  const relatedBrandIds = ids(formData, "relatedBrandIds");

  if (email) {
    const existing = await prisma.contact.findFirst({
      where: { brandId: brand.id, email },
      select: { id: true },
    });
    if (existing) throw new Error("A contact with this email already exists.");
  }

  const tags = tagIds.length
    ? await prisma.contactTag.findMany({
        where: { id: { in: tagIds }, brandId: brand.id, isActive: true },
        select: { id: true },
      })
    : [];

  const clients = clientIds.length
    ? await prisma.ticketClient.findMany({
        where: { id: { in: clientIds }, brandId: brand.id },
        select: { id: true },
      })
    : [];

  const relatedBrands =
    relatedBrandIds.length && isPlatformOperator
      ? await prisma.brand.findMany({
          where: { id: { in: relatedBrandIds }, status: BrandStatus.ACTIVE },
          select: { id: true },
        })
      : [];

  const contact = await prisma.contact.create({
    data: {
      brandId: brand.id,
      name,
      firstName,
      lastName,
      email,
      company,
      roleTitle,
      notes,
      phoneE164,
      isActive: true,
      tagLinks: tags.length
        ? { create: tags.map((tag) => ({ tagId: tag.id })) }
        : undefined,
      clientLinks: clients.length
        ? { create: clients.map((client) => ({ clientId: client.id })) }
        : undefined,
      brandLinks: relatedBrands.length
        ? { create: relatedBrands.map((related) => ({ relatedBrandId: related.id })) }
        : undefined,
    },
    select: { id: true },
  });

  for (const tag of tags) {
    await applyTagPipelineAutomation({
      brandId: brand.id,
      contactId: contact.id,
      tagId: tag.id,
    });
  }

  revalidatePath("/contacts");
}

export async function updateContactAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const contactId = clean(formData.get("contactId"));
  const firstName = clean(formData.get("firstName"));
  const lastName = clean(formData.get("lastName"));
  if (!contactId || !firstName || !lastName) throw new Error("First and last name are required.");

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, brandId: brand.id },
    select: { id: true },
  });
  if (!existing) throw new Error("Contact not found.");

  const email = parseEmail(formData.get("email"));
  if (email) {
    const duplicate = await prisma.contact.findFirst({
      where: { brandId: brand.id, email, NOT: { id: contactId } },
      select: { id: true },
    });
    if (duplicate) throw new Error("A contact with this email already exists.");
  }

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      name: `${firstName} ${lastName}`.replace(/\s+/g, " ").trim(),
      firstName,
      lastName,
      email,
      company: clean(formData.get("company")) || null,
      roleTitle: clean(formData.get("roleTitle")) || null,
      notes: clean(formData.get("notes")) || null,
      phoneE164: parsePhone(formData.get("phone")),
      isActive: formData.get("isActive") === "1",
    },
  });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

export async function archiveContactAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const contactId = clean(formData.get("contactId"));
  const archived = clean(formData.get("archived")) === "1";
  if (!contactId) throw new Error("Contact is required.");

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, brandId: brand.id },
    select: { id: true },
  });
  if (!existing) throw new Error("Contact not found.");

  await prisma.contact.update({
    where: { id: contactId },
    data: { isActive: !archived },
  });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

export async function deleteContactAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const contactId = clean(formData.get("contactId"));
  if (!contactId) throw new Error("Contact is required.");

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, brandId: brand.id },
    select: { id: true },
  });
  if (!existing) throw new Error("Contact not found.");

  await prisma.contact.delete({ where: { id: contactId } });

  revalidatePath("/contacts");
  redirect("/contacts");
}

export async function setContactTagAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const contactId = clean(formData.get("contactId"));
  const tagId = clean(formData.get("tagId"));
  const assigned = clean(formData.get("assigned")) === "1";
  if (!contactId || !tagId) throw new Error("Contact and tag are required.");

  const [contact, tag] = await Promise.all([
    prisma.contact.findFirst({ where: { id: contactId, brandId: brand.id }, select: { id: true } }),
    prisma.contactTag.findFirst({
      where: { id: tagId, brandId: brand.id, isActive: true },
      select: { id: true },
    }),
  ]);
  if (!contact || !tag) throw new Error("Not found.");

  if (assigned) {
    await prisma.contactTagLink.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      create: { contactId, tagId },
      update: {},
    });
    await applyTagPipelineAutomation({ brandId: brand.id, contactId, tagId });
  } else {
    await prisma.contactTagLink.deleteMany({ where: { contactId, tagId } });
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

export async function setContactClientAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const contactId = clean(formData.get("contactId"));
  const clientId = clean(formData.get("clientId"));
  const assigned = clean(formData.get("assigned")) === "1";
  if (!contactId || !clientId) throw new Error("Contact and client are required.");

  const [contact, client] = await Promise.all([
    prisma.contact.findFirst({ where: { id: contactId, brandId: brand.id }, select: { id: true } }),
    prisma.ticketClient.findFirst({
      where: { id: clientId, brandId: brand.id },
      select: { id: true },
    }),
  ]);
  if (!contact || !client) throw new Error("Not found.");

  if (assigned) {
    await prisma.clientContact.upsert({
      where: { clientId_contactId: { clientId, contactId } },
      create: { clientId, contactId },
      update: {},
    });
  } else {
    await prisma.clientContact.deleteMany({ where: { clientId, contactId } });
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

export async function setContactBrandAction(formData: FormData) {
  const { brand, isPlatformOperator } = await requireStaffBrandOrThrow();
  if (!isPlatformOperator) throw new Error("Unauthorized");

  const contactId = clean(formData.get("contactId"));
  const relatedBrandId = clean(formData.get("relatedBrandId"));
  const assigned = clean(formData.get("assigned")) === "1";
  if (!contactId || !relatedBrandId) throw new Error("Contact and brand are required.");

  const [contact, relatedBrand] = await Promise.all([
    prisma.contact.findFirst({ where: { id: contactId, brandId: brand.id }, select: { id: true } }),
    prisma.brand.findFirst({
      where: { id: relatedBrandId, status: BrandStatus.ACTIVE },
      select: { id: true },
    }),
  ]);
  if (!contact || !relatedBrand) throw new Error("Not found.");

  if (assigned) {
    await prisma.contactBrandLink.upsert({
      where: { contactId_relatedBrandId: { contactId, relatedBrandId } },
      create: { contactId, relatedBrandId },
      update: {},
    });
  } else {
    await prisma.contactBrandLink.deleteMany({ where: { contactId, relatedBrandId } });
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

export async function createContactTagAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const label = clean(formData.get("label"));
  if (!label) throw new Error("Tag name is required.");

  const kind = parseKind(clean(formData.get("kind")));
  let key = slugifyTagKey(label);
  const collision = await prisma.contactTag.findUnique({
    where: { brandId_key: { brandId: brand.id, key } },
    select: { id: true },
  });
  if (collision) key = `${key}-${Math.random().toString(36).slice(2, 6)}`;

  const tag = await prisma.contactTag.create({
    data: {
      brandId: brand.id,
      key,
      label,
      kind,
    },
    select: { id: true },
  });

  const contactId = clean(formData.get("contactId"));
  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, brandId: brand.id },
      select: { id: true },
    });
    if (!contact) throw new Error("Contact not found.");
    await prisma.contactTagLink.upsert({
      where: { contactId_tagId: { contactId, tagId: tag.id } },
      create: { contactId, tagId: tag.id },
      update: {},
    });
    await applyTagPipelineAutomation({ brandId: brand.id, contactId, tagId: tag.id });
  }

  revalidateTagPaths(contactId || undefined);
}

export async function updateContactTagAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const tagId = clean(formData.get("tagId"));
  const label = clean(formData.get("label"));
  if (!tagId || !label) throw new Error("Tag name is required.");

  const existing = await prisma.contactTag.findFirst({
    where: { id: tagId, brandId: brand.id },
    select: { id: true },
  });
  if (!existing) throw new Error("Tag not found.");

  await prisma.contactTag.update({
    where: { id: tagId },
    data: {
      label,
      kind: parseKind(clean(formData.get("kind"))),
    },
  });

  revalidateTagPaths();
}

export async function deleteContactTagAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const tagId = clean(formData.get("tagId"));
  if (!tagId) throw new Error("Tag is required.");

  const existing = await prisma.contactTag.findFirst({
    where: { id: tagId, brandId: brand.id },
    select: { id: true },
  });
  if (!existing) throw new Error("Tag not found.");

  await prisma.contactTag.delete({ where: { id: tagId } });
  revalidateTagPaths();
}

export async function saveTagAutomationAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const tagId = clean(formData.get("tagId"));
  const pipelineId = clean(formData.get("pipelineId"));
  if (!tagId) throw new Error("Tag is required.");

  const tag = await prisma.contactTag.findFirst({
    where: { id: tagId, brandId: brand.id },
    select: { id: true },
  });
  if (!tag) throw new Error("Tag not found.");

  await prisma.contactTagAutomation.deleteMany({
    where: { brandId: brand.id, tagId },
  });

  if (!pipelineId) {
    revalidateTagPaths();
    return;
  }

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, brandId: brand.id, isActive: true },
    select: {
      id: true,
      stages: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!pipeline) throw new Error("Pipeline not found.");

  await prisma.contactTagAutomation.create({
    data: {
      brandId: brand.id,
      tagId,
      pipelineId: pipeline.id,
      stageId: pipeline.stages[0]?.id ?? null,
      isActive: true,
    },
  });

  revalidateTagPaths();
}
