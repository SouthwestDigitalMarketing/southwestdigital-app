"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";
import { contactSearchWhere } from "@/lib/contacts/query";
import { parseEmailOrThrow } from "@/lib/email";
import { parseSubmittedPhone } from "@/lib/phone";
import { isOfferKindKey, type OfferKindKey } from "@/lib/quotes/kinds";

export type OfferAudienceContact = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  roleTitle: string | null;
  phoneE164: string | null;
};

const CONTACT_SELECT = {
  id: true,
  name: true,
  email: true,
  company: true,
  roleTitle: true,
  phoneE164: true,
} as const;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asJsonObject(value: unknown): Prisma.InputJsonObject {
  try {
    const parsed: unknown = JSON.parse(JSON.stringify(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Offer data must be a JSON object.");
    }
    return parsed as Prisma.InputJsonObject;
  } catch (error) {
    if (error instanceof Error && error.message === "Offer data must be a JSON object.") throw error;
    throw new Error("Offer data could not be saved.");
  }
}

export async function searchOfferContactsAction(
  query: string,
  tagIds: string[] = [],
): Promise<OfferAudienceContact[]> {
  const { brand } = await requireQuoteStaffOrThrow();
  return prisma.contact.findMany({
    where: contactSearchWhere({
      brandId: brand.id,
      q: query.trim(),
      status: "active",
      tagIds,
    }),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 80,
    select: CONTACT_SELECT,
  });
}

export async function createOfferAudienceContactAction(formData: FormData): Promise<OfferAudienceContact> {
  const { brand } = await requireQuoteStaffOrThrow();
  const firstName = clean(formData.get("firstName"));
  const lastName = clean(formData.get("lastName"));
  if (!firstName || !lastName) throw new Error("First and last name are required.");

  const name = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  const email = parseEmailOrThrow(clean(formData.get("email")));
  const company = clean(formData.get("company")) || null;
  const phoneE164 = parseSubmittedPhone(clean(formData.get("phone")));

  if (email) {
    const existing = await prisma.contact.findFirst({
      where: { brandId: brand.id, email },
      select: { id: true },
    });
    if (existing) throw new Error("A contact with this email already exists.");
  }

  const contact = await prisma.contact.create({
    data: {
      brandId: brand.id,
      name,
      firstName,
      lastName,
      email,
      company,
      phoneE164,
      isActive: true,
    },
    select: CONTACT_SELECT,
  });

  revalidatePath("/contacts");
  revalidatePath("/offers");
  return contact;
}

export async function syncOfferContactsAction(payload: {
  companyName: string;
  people: Array<{
    contactId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    roleTitle: string;
  }>;
}) {
  const { brand } = await requireQuoteStaffOrThrow();
  const companyName = payload.companyName.trim();

  for (const person of payload.people) {
    const contactId = person.contactId.trim();
    if (!contactId) continue;

    const existing = await prisma.contact.findFirst({
      where: { id: contactId, brandId: brand.id },
      select: { id: true },
    });
    if (!existing) continue;

    const firstName = person.firstName.trim();
    const lastName = person.lastName.trim();
    const email = parseEmailOrThrow(person.email);
    const phone = person.phone.trim() ? parseSubmittedPhone(person.phone.trim()) : null;
    const roleTitle = person.roleTitle.trim();

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(firstName && lastName
          ? { firstName, lastName, name: `${firstName} ${lastName}`.replace(/\s+/g, " ").trim() }
          : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phoneE164: phone } : {}),
        ...(companyName ? { company: companyName } : {}),
        ...(roleTitle ? { roleTitle } : {}),
      },
    });
  }

  revalidatePath("/contacts");
}

function offerSlug(name: string) {
  const clientPart = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20) || "offer";
  const datePart = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${clientPart}-${datePart}-${rand}`;
}

export async function startOfferDraftAction(kind: OfferKindKey, contactIds: string[]) {
  const { brand } = await requireQuoteStaffOrThrow();
  if (!isOfferKindKey(kind)) throw new Error("Unknown offer type.");
  const ids = [...new Set(contactIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new Error("Select at least one contact.");

  const contacts = await prisma.contact.findMany({
    where: { brandId: brand.id, id: { in: ids } },
    select: { id: true, name: true, email: true, company: true },
  });
  if (contacts.length === 0) throw new Error("Contact not found.");

  const ordered = ids
    .map((id) => contacts.find((contact) => contact.id === id))
    .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));
  const primary = ordered[0];
  const email = (primary.email ?? "").trim().toLowerCase() || `${primary.id}@contacts.local`;

  let client = await prisma.quoteClient.findFirst({
    where: { brandId: brand.id, email },
    select: { id: true },
  });
  if (!client) {
    client = await prisma.quoteClient.create({
      data: {
        brandId: brand.id,
        name: primary.name,
        email,
        company: primary.company,
      },
      select: { id: true },
    });
  }

  const quote = await prisma.quote.create({
    data: {
      brandId: brand.id,
      slug: offerSlug(primary.name),
      clientId: client.id,
      kind,
      status: "draft",
      snapshotJson: {
        kind,
        contactIds: ordered.map((contact) => contact.id),
      },
    },
    select: { id: true },
  });

  revalidatePath("/offers");
  return { offerId: quote.id };
}

export async function saveOfferDraftAction(
  offerId: string,
  state: { contactInfo?: unknown; assessment?: unknown },
) {
  const { brand } = await requireQuoteStaffOrThrow();
  const existing = await prisma.quote.findFirst({
    where: { id: offerId, brandId: brand.id },
    select: { id: true, status: true, snapshotJson: true, kind: true },
  });
  if (!existing) throw new Error("Offer not found.");
  if (existing.status === "archived") throw new Error("This offer is archived.");

  const previous =
    existing.snapshotJson && typeof existing.snapshotJson === "object"
      ? (existing.snapshotJson as Record<string, unknown>)
      : {};

  await prisma.quote.update({
    where: { id: existing.id },
    data: {
      snapshotJson: asJsonObject({
        ...previous,
        kind: existing.kind,
        contactInfo: state.contactInfo ?? previous.contactInfo,
        assessment: state.assessment ?? previous.assessment,
      }),
    },
  });

  revalidatePath("/offers");
  revalidatePath(`/offers/${existing.id}`);
}

export async function publishOfferChangesAction(
  offerId: string,
  state: { contactInfo?: unknown; assessment?: unknown },
) {
  const { brand } = await requireQuoteStaffOrThrow();
  const existing = await prisma.quote.findFirst({
    where: { id: offerId, brandId: brand.id },
    select: { id: true, status: true, snapshotJson: true, kind: true, publicToken: true },
  });
  if (!existing) throw new Error("Offer not found.");
  if (existing.status === "archived") throw new Error("This offer is archived.");

  const previous =
    existing.snapshotJson && typeof existing.snapshotJson === "object"
      ? (existing.snapshotJson as Record<string, unknown>)
      : {};
  const snapshot = asJsonObject({
    ...previous,
    kind: existing.kind,
    contactInfo: state.contactInfo ?? previous.contactInfo,
    assessment: state.assessment ?? previous.assessment,
  });
  const publicToken = existing.publicToken ?? randomBytes(32).toString("base64url");

  await prisma.quote.update({
    where: { id: existing.id },
    data: {
      snapshotJson: snapshot,
      publishedSnapshotJson: snapshot,
      publicToken,
      publishedAt: new Date(),
    },
  });

  revalidatePath("/offers");
  revalidatePath(`/offers/${existing.id}`);
  revalidatePath(`/proposal/${publicToken}`);
  return { publicPath: `/proposal/${publicToken}` };
}

export async function getOfferPublicPathAction(offerId: string) {
  const { brand } = await requireQuoteStaffOrThrow();
  const quote = await prisma.quote.findFirst({
    where: { id: offerId, brandId: brand.id, publishedAt: { not: null } },
    select: { publicToken: true },
  });
  return quote?.publicToken ? `/proposal/${quote.publicToken}` : null;
}
