"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";
import { contactInfoFromCrm } from "@/lib/quotes/fromContacts";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { ensureQuoteEngagement } from "@/lib/engagements/fromOffer";
import {
  quoteClientDetailsFromSnapshot,
} from "@/lib/quotes/clientInfo";
export async function markQuoteSentAction(formData: FormData) {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  if (!id) throw new Error("Quote ID required");

  const quote = await prisma.quote.findFirst({
    where: { id, brandId: brand.id },
    select: { id: true, status: true, firstSentAt: true },
  });
  if (!quote) throw new Error("Not found");
  if (quote.status !== "draft" && quote.status !== "completed") {
    throw new Error("Only unsent offers can be marked sent");
  }

  const now = new Date();
  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: "sent",
      sentAt: now,
      firstSentAt: quote.firstSentAt ?? now,
      lastSentAt: now,
    },
  });

  revalidatePath("/offers");
  redirect(`/offers/${id}?sent=1`);
}

export async function resendQuoteAction(formData: FormData) {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  if (!id) throw new Error("Quote ID required");

  const quote = await prisma.quote.findFirst({
    where: { id, brandId: brand.id },
    select: { id: true, status: true, firstSentAt: true },
  });
  if (!quote) throw new Error("Not found");
  if (quote.status === "draft" || quote.status === "archived") {
    throw new Error("Only sent offers can be resent");
  }

  const now = new Date();
  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: "sent",
      sentAt: now,
      firstSentAt: quote.firstSentAt ?? now,
      lastSentAt: now,
    },
  });

  revalidatePath("/offers");
  revalidatePath(`/offers/${id}`);
}

function offerSlug(name: string) {
  const clientPart =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20) || "offer";
  const datePart = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${clientPart}-${datePart}-${rand}`;
}

export async function reassignQuoteContactAction(formData: FormData) {
  const { brand } = await requireQuoteStaffOrThrow();
  const quoteId = (formData.get("id") as string | null)?.trim() ?? "";
  const contactId = (formData.get("contactId") as string | null)?.trim() ?? "";
  if (!quoteId) throw new Error("Quote ID required");
  if (!contactId) throw new Error("Contact ID required");

  const [quote, contact] = await Promise.all([
    prisma.quote.findFirst({
      where: { id: quoteId, brandId: brand.id },
      select: {
        id: true,
        clientId: true,
        engagementId: true,
        publishedAt: true,
        publicToken: true,
        snapshotJson: true,
        client: { select: { name: true, email: true, company: true } },
      },
    }),
    prisma.contact.findFirst({
      where: { id: contactId, brandId: brand.id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneE164: true,
        phoneNumber: true,
        company: true,
        roleTitle: true,
      },
    }),
  ]);

  if (!quote) throw new Error("Not found");
  if (!contact) throw new Error("Contact not found");
  if (!quote.snapshotJson || typeof quote.snapshotJson !== "object" || Array.isArray(quote.snapshotJson)) {
    throw new Error("Offer snapshot is malformed.");
  }

  const snapshot = {
    ...quote.snapshotJson,
    contactInfo: contactInfoFromCrm([
      {
        ...contact,
        phoneNumber: contact.phoneNumber ?? undefined,
      },
    ]),
  };
  const client = quoteClientDetailsFromSnapshot(snapshot, quote.client);
  const clientRecord = await prisma.quoteClient.create({
    data: {
      brandId: brand.id,
      name: client.name,
      email: client.email,
      company: client.company,
    },
    select: { id: true },
  });

  const { quoteRevisions, quoteEngagement } = await getSchemaCapabilities();
  const publishedAt = quote.publishedAt;
  const publicToken = quote.publicToken ?? randomBytes(32).toString("base64url");

  if (!publishedAt) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        clientId: clientRecord.id,
        snapshotJson: snapshot,
      },
    });
  } else if (!quoteRevisions) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        clientId: clientRecord.id,
        snapshotJson: snapshot,
        publishedSnapshotJson: snapshot,
        publicToken,
        publishedAt,
      },
    });
  } else {
    const latestRevision = await prisma.quoteRevision.findFirst({
      where: { brandId: brand.id, quoteId: quote.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latestRevision?.version ?? 0) + 1;

    await prisma.$transaction([
      prisma.quoteRevision.updateMany({
        where: { brandId: brand.id, quoteId: quote.id, supersededAt: null },
        data: { supersededAt: publishedAt },
      }),
      prisma.quoteRevision.create({
        data: {
          brandId: brand.id,
          quoteId: quote.id,
          version,
          snapshotJson: snapshot,
          publishedAt,
        },
      }),
      prisma.quote.update({
        where: { id: quote.id },
        data: {
          clientId: clientRecord.id,
          snapshotJson: snapshot,
          publishedSnapshotJson: snapshot,
          publicToken,
          publishedAt,
        },
      }),
    ]);
  }

  if (quoteEngagement && (quote.engagementId || publishedAt)) {
    await ensureQuoteEngagement({
      brandId: brand.id,
      quoteId: quote.id,
        snapshot: {
          contactInfo: snapshot.contactInfo,
          assessment: (snapshot as Record<string, unknown>).assessment,
          isTestProposal: (snapshot as Record<string, unknown>).isTestProposal,
        },
    });
  }

  revalidatePath("/offers");
  revalidatePath(`/offers/${quote.id}`);
  if (publishedAt) {
    revalidatePath(`/proposal/${publicToken}`);
  }
}

export async function duplicateQuoteAction(formData: FormData) {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const contactId = (formData.get("contactId") as string | null)?.trim() ?? "";
  const archived = formData.get("archived") === "1";
  const testProposal = formData.get("testProposal") === "1";
  if (!id) throw new Error("Quote ID required");

  const [quote, contact] = await Promise.all([
    prisma.quote.findFirst({
      where: { id, brandId: brand.id },
      include: {
        client: { select: { name: true, email: true, company: true } },
        lineItems: { orderBy: { sortOrder: "asc" } },
      },
    }),
    contactId
      ? prisma.contact.findFirst({
          where: { id: contactId, brandId: brand.id },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneE164: true,
            phoneNumber: true,
            company: true,
            roleTitle: true,
          },
        })
      : Promise.resolve(null),
  ]);
  if (!quote) throw new Error("Not found");
  if (contactId && !contact) throw new Error("Contact not found");
  if (!quote.snapshotJson || typeof quote.snapshotJson !== "object" || Array.isArray(quote.snapshotJson)) {
    throw new Error("Offer snapshot is malformed.");
  }

  const sourceSnapshot = quote.snapshotJson as Record<string, unknown>;
  const sourceAssessment = sourceSnapshot.assessment;
  const freshAssessment = sourceAssessment && typeof sourceAssessment === "object" && !Array.isArray(sourceAssessment)
    ? { ...(sourceAssessment as Record<string, unknown>), waiveOnboardingFee: false }
    : null;
  const snapshot = {
    ...sourceSnapshot,
    // Duplicates are fresh lead-facing proposals and must not inherit
    // contact-specific promotions from the source offer.
    isFreshDuplicate: true,
    duplicatedFromOfferCode: quote.offerCode,
    suppressPromotions: true,
    isTestProposal: testProposal,
    ...(freshAssessment ? { assessment: freshAssessment } : {}),
    ...(contact
      ? {
          contactInfo: contactInfoFromCrm([
            { ...contact, phoneNumber: contact.phoneNumber ?? undefined },
          ]),
        }
      : {}),
  } as Prisma.InputJsonValue;

  const client = quoteClientDetailsFromSnapshot(snapshot, quote.client);
  const clientRecord = await prisma.quoteClient.create({
    data: {
      brandId: brand.id,
      name: client.name,
      email: client.email,
      company: client.company,
    },
    select: { id: true },
  });

  const duplicate = await prisma.quote.create({
    data: {
      brandId: brand.id,
      slug: offerSlug(client.name),
      clientId: clientRecord.id,
      kind: quote.kind,
      status: archived ? "archived" : "draft",
      packageId: quote.packageId,
      totalOneTime: quote.totalOneTime,
      totalRecurring: quote.totalRecurring,
      onboardingFee: quote.onboardingFee,
      snapshotJson: snapshot,
      // A duplicate is a new lead-facing proposal. Never carry over the
      // original proposal link, publication/view state, engagement, or send
      // timestamps, even if a database default or a future schema change adds
      // one of those fields.
      publishedSnapshotJson: Prisma.DbNull,
      publicToken: null,
      publishedAt: null,
      firstViewedAt: null,
      engagementId: null,
      sentAt: null,
      firstSentAt: null,
      lastSentAt: null,
      expiresAt: null,
      lineItems: {
        create: quote.lineItems.map((item, index) => ({
          label: item.label,
          description: item.description,
          amount: item.amount,
          billingType: item.billingType,
          sortOrder: index * 10,
        })),
      },
    },
    select: { id: true, kind: true },
  });

  revalidatePath("/offers");
  redirect(`/offers?highlight=${duplicate.id}${archived ? "&archived=1" : ""}`);
}

export async function clearDuplicateMarkerAction(formData: FormData) {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  if (!id) throw new Error("Offer ID required");

  const quote = await prisma.quote.findFirst({
    where: { id, brandId: brand.id },
    select: { id: true, snapshotJson: true },
  });
  if (!quote) throw new Error("Not found");
  if (!quote.snapshotJson || typeof quote.snapshotJson !== "object" || Array.isArray(quote.snapshotJson)) {
    throw new Error("Offer snapshot is malformed.");
  }

  const snapshot = Object.fromEntries(
    Object.entries(quote.snapshotJson as Record<string, unknown>)
      .filter(([key]) => key !== "isFreshDuplicate"),
  );
  await prisma.quote.update({
    where: { id: quote.id },
    data: { snapshotJson: snapshot as Prisma.InputJsonValue },
  });

  revalidatePath("/offers");
}

export async function deleteQuoteAction(formData: FormData) {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  if (!id) throw new Error("Offer ID required");

  const quote = await prisma.quote.findFirst({
    where: { id, brandId: brand.id },
    select: { id: true, status: true },
  });
  if (!quote) throw new Error("Not found");
  await prisma.quote.delete({ where: { id: quote.id } });
  revalidatePath("/offers");
}

export async function setOfferStatusAction(formData: FormData) {
  const { brand } = await requireQuoteStaffOrThrow();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const status = (formData.get("status") as string | null)?.trim() ?? "";
  if (!id) throw new Error("Offer ID required");
  if (
    status !== "draft" &&
    status !== "completed" &&
    status !== "archived" &&
    status !== "sent" &&
    status !== "accepted" &&
    status !== "rejected"
  ) {
    throw new Error("Invalid offer status.");
  }

  const quote = await prisma.quote.findFirst({
    where: { id, brandId: brand.id },
    select: { id: true, sentAt: true, firstSentAt: true },
  });
  if (!quote) throw new Error("Not found");

  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status,
      ...(status === "sent"
        ? {
            sentAt: new Date(),
            firstSentAt: quote.firstSentAt ?? quote.sentAt ?? new Date(),
            lastSentAt: new Date(),
          }
        : {}),
    },
  });

  revalidatePath("/offers");
  revalidatePath(`/offers/${id}`);
}
