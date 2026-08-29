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
import { tagMarksRealEstate } from "@/lib/quotes/catalog";

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
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
}

function revalidateTagPaths(contactId?: string) {
  revalidatePath("/contacts");
  revalidatePath("/tags");
  revalidatePath("/settings");
  revalidatePath("/settings/tags");
  revalidatePath("/services");
  revalidatePath("/offers/included");
  revalidatePath("/offers/add-ons");
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
  const { session, brand, isPlatformOperator } = await requireStaffBrandOrThrow();
  const firstName = clean(formData.get("firstName"));
  const lastName = clean(formData.get("lastName"));
  if (!firstName || !lastName)
    throw new Error("First and last name are required.");

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
        ? {
            create: relatedBrands.map((related) => ({
              relatedBrandId: related.id,
            })),
          }
        : undefined,
    },
    select: { id: true },
  });

  for (const tag of tags) {
    await applyTagPipelineAutomation({
      brandId: brand.id,
      actorUserId: session.user.id,
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
  if (!contactId || !firstName || !lastName)
    throw new Error("First and last name are required.");

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

type ImportContactRow = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
};

export type ImportContactsResult = {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

export async function importContactsAction(input: {
  rows: ImportContactRow[];
  tagId?: string | null;
}): Promise<ImportContactsResult> {
  const { session, brand } = await requireStaffBrandOrThrow();
  const result: ImportContactsResult = { created: 0, skipped: 0, errors: [] };

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    throw new Error("The import does not contain any contact rows.");
  }
  if (input.rows.length > 1_000) {
    throw new Error("Import up to 1,000 contacts at a time.");
  }

  const tagId = input.tagId?.trim() || null;
  let tag: { id: string } | null = null;
  if (tagId) {
    tag = await prisma.contactTag.findFirst({
      where: { id: tagId, brandId: brand.id, isActive: true },
      select: { id: true },
    });
    if (!tag) throw new Error("Selected tag is not available.");
  }

  for (let index = 0; index < input.rows.length; index += 1) {
    const raw = input.rows[index] ?? {};
    const rowNumber = index + 2; // header is row 1
    try {
      const fullName = typeof raw.name === "string" ? raw.name.trim() : "";
      let firstName = typeof raw.firstName === "string" ? raw.firstName.trim() : "";
      let lastName = typeof raw.lastName === "string" ? raw.lastName.trim() : "";
      if (!firstName && !lastName && fullName) {
        const nameParts = fullName.split(/\s+/);
        firstName = nameParts.shift() ?? "";
        lastName = nameParts.join(" ");
      }
      if (!firstName && !lastName) {
        result.skipped += 1;
        continue;
      }
      const name = fullName || `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
      const email = typeof raw.email === "string" && raw.email.trim()
        ? parseEmailOrThrow(raw.email)
        : null;
      const phoneE164 = typeof raw.phone === "string" && raw.phone.trim()
        ? parseSubmittedPhone(raw.phone)
        : null;
      const company = typeof raw.company === "string" ? raw.company.trim() || null : null;
      const notes = typeof raw.notes === "string" ? raw.notes.trim() || null : null;

      if (email || phoneE164) {
        const existing = await prisma.contact.findFirst({
          where: {
            brandId: brand.id,
            OR: [
              ...(email ? [{ email }] : []),
              ...(phoneE164 ? [{ phoneE164 }] : []),
            ],
          },
          select: { id: true },
        });
        if (existing) {
          result.skipped += 1;
          continue;
        }
      }

      const contact = await prisma.contact.create({
        data: {
          brandId: brand.id,
          name,
          firstName: firstName || name,
          lastName: lastName || "",
          email,
          phoneE164,
          company,
          notes,
          isActive: true,
          tagLinks: tag ? { create: [{ tagId: tag.id }] } : undefined,
        },
        select: { id: true },
      });

      if (tag) {
        await applyTagPipelineAutomation({
          brandId: brand.id,
          actorUserId: session.user.id,
          contactId: contact.id,
          tagId: tag.id,
        });
      }

      result.created += 1;
    } catch (err) {
      result.errors.push({
        row: rowNumber,
        message: err instanceof Error ? err.message : "Unknown import error",
      });
      result.skipped += 1;
    }
  }

  revalidatePath("/contacts");
  revalidatePath("/tags");
  revalidatePath("/settings/tags");
  revalidatePath("/pipeline");
  return result;
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
  const { session, brand } = await requireStaffBrandOrThrow();
  const contactId = clean(formData.get("contactId"));
  const tagId = clean(formData.get("tagId"));
  const assigned = clean(formData.get("assigned")) === "1";
  if (!contactId || !tagId) throw new Error("Contact and tag are required.");

  const [contact, tag] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: contactId, brandId: brand.id },
      select: { id: true },
    }),
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
    await applyTagPipelineAutomation({
      brandId: brand.id,
      actorUserId: session.user.id,
      contactId,
      tagId,
    });
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
  if (!contactId || !clientId)
    throw new Error("Contact and client are required.");

  const [contact, client] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: contactId, brandId: brand.id },
      select: { id: true },
    }),
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
  if (!contactId || !relatedBrandId)
    throw new Error("Contact and brand are required.");

  const [contact, relatedBrand] = await Promise.all([
    prisma.contact.findFirst({
      where: { id: contactId, brandId: brand.id },
      select: { id: true },
    }),
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
    await prisma.contactBrandLink.deleteMany({
      where: { contactId, relatedBrandId },
    });
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

export async function createContactTagAction(formData: FormData) {
  const { session, brand } = await requireStaffBrandOrThrow();
  const label = clean(formData.get("label"));
  if (!label) throw new Error("Tag name is required.");

  const kind = parseKind(clean(formData.get("kind")));
  const key = slugifyTagKey(label);
  const collision = await prisma.contactTag.findFirst({
    where: {
      brandId: brand.id,
      OR: [
        { key },
        { label: { equals: label, mode: "insensitive" } },
      ],
    },
    select: { label: true },
  });
  if (collision) throw new Error(`A similar tag already exists: “${collision.label}”.`);
  if (tagMarksRealEstate({ key, label })) {
    const canonical = await prisma.contactTag.findFirst({
      where: { brandId: brand.id, key: "real-estate" },
      select: { label: true },
    });
    if (canonical) throw new Error(`Use the existing “${canonical.label}” tag for real-estate services.`);
  }

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
    await applyTagPipelineAutomation({
      brandId: brand.id,
      actorUserId: session.user.id,
      contactId,
      tagId: tag.id,
    });
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
  const duplicate = await prisma.contactTag.findFirst({
    where: {
      brandId: brand.id,
      id: { not: tagId },
      label: { equals: label, mode: "insensitive" },
    },
    select: { label: true },
  });
  if (duplicate) throw new Error(`A similar tag already exists: “${duplicate.label}”.`);
  const nextKey = slugifyTagKey(label);
  if (tagMarksRealEstate({ key: nextKey, label })) {
    const canonical = await prisma.contactTag.findFirst({
      where: { brandId: brand.id, key: "real-estate", id: { not: tagId } },
      select: { label: true },
    });
    if (canonical) throw new Error(`Use the existing “${canonical.label}” tag for real-estate services.`);
  }

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
  const requestedStageId = clean(formData.get("stageId"));
  if (!tagId) throw new Error("Tag is required.");

  const tag = await prisma.contactTag.findFirst({
    where: { id: tagId, brandId: brand.id },
    select: { id: true },
  });
  if (!tag) throw new Error("Tag not found.");

  if (!pipelineId) {
    await prisma.contactTagAutomation.deleteMany({
      where: { brandId: brand.id, tagId },
    });
    revalidateTagPaths();
    return;
  }

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, brandId: brand.id, isActive: true },
    select: {
      id: true,
      stages: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      },
    },
  });
  if (!pipeline) throw new Error("Pipeline not found.");
  if (pipeline.stages.length === 0) throw new Error("Add an active pipeline stage before enabling this automation.");

  const firstStageId = pipeline.stages[0]?.id ?? null;
  const stageId = requestedStageId && pipeline.stages.some((s) => s.id === requestedStageId)
    ? requestedStageId
    : firstStageId;

  await prisma.$transaction([
    prisma.contactTagAutomation.deleteMany({
      where: { brandId: brand.id, tagId },
    }),
    prisma.contactTagAutomation.create({
      data: {
        brandId: brand.id,
        tagId,
        pipelineId: pipeline.id,
        stageId,
        isActive: true,
      },
    }),
  ]);

  revalidateTagPaths();
}
