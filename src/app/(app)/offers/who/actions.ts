"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { BrandStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";
import { contactSearchWhere } from "@/lib/contacts/query";
import { parseEmailOrThrow } from "@/lib/email";
import { parseSubmittedPhone } from "@/lib/phone";
import { isOfferKindKey, type OfferKindKey } from "@/lib/quotes/kinds";
import { materializeProposalCatalog } from "@/lib/quotes/materializeProposalCatalog";
import { materializeAgreementTemplate } from "@/lib/agreements/materialize";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { ensureQuoteEngagement } from "@/lib/engagements/fromOffer";
import { quoteClientDetailsFromSnapshot } from "@/lib/quotes/clientInfo";
import { applyTagPipelineAutomation } from "@/lib/contacts/automation";

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

function ids(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
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

async function ensureExclusiveQuoteClient(
  tx: Prisma.TransactionClient,
  input: {
    brandId: string;
    quoteId: string;
    clientId: string;
    snapshot: unknown;
    fallbackClient: { name: string; email: string; company: string | null };
  },
) {
  const clientData = quoteClientDetailsFromSnapshot(input.snapshot, input.fallbackClient);
  const usage = await tx.quote.count({ where: { clientId: input.clientId } });

  if (usage > 1) {
    const cloned = await tx.quoteClient.create({
      data: {
        brandId: input.brandId,
        name: clientData.name,
        email: clientData.email,
        company: clientData.company,
      },
      select: { id: true },
    });

    await tx.quote.update({
      where: { id: input.quoteId },
      data: { clientId: cloned.id },
    });

    return cloned.id;
  }

  await tx.quoteClient.update({
    where: { id: input.clientId },
    data: clientData,
  });

  return input.clientId;
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
  const { session, brand, isPlatformOperator } = await requireQuoteStaffOrThrow();
  const firstName = clean(formData.get("firstName"));
  const lastName = clean(formData.get("lastName"));
  if (!firstName || !lastName) throw new Error("First and last name are required.");

  const name = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  const email = parseEmailOrThrow(clean(formData.get("email")));
  const company = clean(formData.get("company")) || null;
  const roleTitle = clean(formData.get("roleTitle")) || null;
  const notes = clean(formData.get("notes")) || null;
  const phoneE164 = parseSubmittedPhone(clean(formData.get("phone")));
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

  const [tags, clients, relatedBrands] = await Promise.all([
    tagIds.length
      ? prisma.contactTag.findMany({
          where: { id: { in: tagIds }, brandId: brand.id, isActive: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    clientIds.length
      ? prisma.ticketClient.findMany({
          where: { id: { in: clientIds }, brandId: brand.id, isActive: true },
          select: { id: true },
        })
      : Promise.resolve([]),
    relatedBrandIds.length && isPlatformOperator
      ? prisma.brand.findMany({
          where: { id: { in: relatedBrandIds }, status: BrandStatus.ACTIVE },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

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
            create: relatedBrands.map((relatedBrand) => ({
              relatedBrandId: relatedBrand.id,
            })),
          }
        : undefined,
    },
    select: CONTACT_SELECT,
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
  revalidatePath("/offers");
  revalidatePath("/pipeline");
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
  const client = await prisma.quoteClient.create({
    data: {
      brandId: brand.id,
      name: primary.name,
      email,
      company: primary.company,
    },
    select: { id: true },
  });

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
  state: { contactInfo?: unknown; assessment?: unknown; pricing?: unknown; isTestProposal?: boolean },
) {
  const { brand } = await requireQuoteStaffOrThrow();
  const existing = await prisma.quote.findFirst({
    where: { id: offerId, brandId: brand.id },
    select: {
      id: true,
      status: true,
      snapshotJson: true,
      kind: true,
      clientId: true,
      client: { select: { name: true, email: true, company: true } },
    },
  });
  if (!existing) throw new Error("Offer not found.");
  if (existing.status === "archived") throw new Error("This offer is archived.");

  const previous =
    existing.snapshotJson && typeof existing.snapshotJson === "object"
      ? (existing.snapshotJson as Record<string, unknown>)
      : {};
  const catalogAssessment = await materializeProposalCatalog(
    brand.id,
    state.assessment ?? previous.assessment,
  );
  const assessment = await materializeAgreementTemplate(brand.id, catalogAssessment);
  const snapshot = asJsonObject({
    ...previous,
    kind: existing.kind,
    contactInfo: state.contactInfo ?? previous.contactInfo,
    assessment,
    pricing: state.pricing ?? previous.pricing,
    isTestProposal: state.isTestProposal ?? previous.isTestProposal,
  });

  await prisma.$transaction(async (tx) => {
    const clientId = await ensureExclusiveQuoteClient(tx, {
      brandId: brand.id,
      quoteId: existing.id,
      clientId: existing.clientId,
      snapshot,
      fallbackClient: existing.client,
    });

    await tx.quote.update({
      where: { id: existing.id },
      data: { clientId, snapshotJson: snapshot },
    });
  });

  revalidatePath("/offers");
  revalidatePath(`/offers/${existing.id}`);
}

export async function publishOfferChangesAction(
  offerId: string,
  state: { contactInfo?: unknown; assessment?: unknown; pricing?: unknown; isTestProposal?: boolean },
) {
  const { brand } = await requireQuoteStaffOrThrow();
  const existing = await prisma.quote.findFirst({
    where: { id: offerId, brandId: brand.id },
    select: {
      id: true,
      status: true,
      snapshotJson: true,
      kind: true,
      publicToken: true,
      clientId: true,
      client: { select: { name: true, email: true, company: true } },
    },
  });
  if (!existing) throw new Error("Offer not found.");
  if (existing.status === "archived") throw new Error("This offer is archived.");

  const previous =
    existing.snapshotJson && typeof existing.snapshotJson === "object"
      ? (existing.snapshotJson as Record<string, unknown>)
      : {};
  const catalogAssessment = await materializeProposalCatalog(
    brand.id,
    state.assessment ?? previous.assessment,
    { freezeApplicability: true },
  );
  const assessment = await materializeAgreementTemplate(brand.id, catalogAssessment);
  const snapshot = asJsonObject({
    ...previous,
    kind: existing.kind,
    contactInfo: state.contactInfo ?? previous.contactInfo,
    assessment,
    pricing: state.pricing ?? previous.pricing,
    isTestProposal: state.isTestProposal ?? previous.isTestProposal,
  });
  const publicToken = existing.publicToken ?? randomBytes(32).toString("base64url");
  const { quoteRevisions, quoteEngagement } = await getSchemaCapabilities();
  const publishedAt = new Date();

  if (!quoteRevisions) {
    await prisma.$transaction(async (tx) => {
      const clientId = await ensureExclusiveQuoteClient(tx, {
        brandId: brand.id,
        quoteId: existing.id,
        clientId: existing.clientId,
        snapshot,
        fallbackClient: existing.client,
      });

      await tx.quote.update({
        where: { id: existing.id },
        data: {
          clientId,
          snapshotJson: snapshot,
          publishedSnapshotJson: snapshot,
          publicToken,
          publishedAt,
          lastActivityAt: publishedAt,
        },
      });
    });
    if (quoteEngagement) {
      await ensureQuoteEngagement({
        brandId: brand.id,
        quoteId: existing.id,
        snapshot: {
          contactInfo: snapshot.contactInfo,
          assessment: snapshot.assessment,
          isTestProposal: snapshot.isTestProposal,
        },
      });
    }
    revalidatePath("/offers");
    revalidatePath(`/offers/${existing.id}`);
    revalidatePath(`/proposal/${publicToken}`);
    return { publicPath: `/proposal/${publicToken}`, version: 1 };
  }

  const latestRevision = await prisma.quoteRevision.findFirst({
    where: { brandId: brand.id, quoteId: existing.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latestRevision?.version ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    const clientId = await ensureExclusiveQuoteClient(tx, {
      brandId: brand.id,
      quoteId: existing.id,
      clientId: existing.clientId,
      snapshot,
      fallbackClient: existing.client,
    });

    await tx.quoteRevision.updateMany({
      where: { brandId: brand.id, quoteId: existing.id, supersededAt: null },
      data: { supersededAt: publishedAt },
    });
    await tx.quoteRevision.create({
      data: {
        brandId: brand.id,
        quoteId: existing.id,
        version,
        snapshotJson: snapshot,
        publishedAt,
      },
    });
    await tx.quote.update({
      where: { id: existing.id },
      data: {
        clientId,
        snapshotJson: snapshot,
        publishedSnapshotJson: snapshot,
        publicToken,
        publishedAt,
        lastActivityAt: publishedAt,
      },
    });
  });

  if (quoteEngagement) {
    await ensureQuoteEngagement({
      brandId: brand.id,
      quoteId: existing.id,
      snapshot: {
        contactInfo: snapshot.contactInfo,
        assessment: snapshot.assessment,
        isTestProposal: snapshot.isTestProposal,
      },
    });
  }

  revalidatePath("/offers");
  revalidatePath(`/offers/${existing.id}`);
  revalidatePath(`/proposal/${publicToken}`);
  return { publicPath: `/proposal/${publicToken}`, version };
}

export async function getOfferPublicPathAction(offerId: string) {
  const { brand } = await requireQuoteStaffOrThrow();
  const quote = await prisma.quote.findFirst({
    where: { id: offerId, brandId: brand.id, publishedAt: { not: null } },
    select: { publicToken: true },
  });
  return quote?.publicToken ? `/proposal/${quote.publicToken}` : null;
}

export async function getOfferKindAction(offerId: string): Promise<string | null> {
  const { brand } = await requireQuoteStaffOrThrow();
  const quote = await prisma.quote.findFirst({
    where: { id: offerId, brandId: brand.id },
    select: { kind: true },
  });
  return quote?.kind ?? null;
}
