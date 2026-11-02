import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";
import { isOfferKindKey, type OfferKindKey } from "@/lib/quotes/kinds";
import { materializeProposalCatalog } from "@/lib/quotes/materializeProposalCatalog";
import { materializeAgreementTemplate } from "@/lib/agreements/materialize";
import { PipeBrandError, resolveBrand } from "./contacts";

/**
 * Offers/quotes reachable by the `pipe` terminal tool (LochsideLLC/sales),
 * authenticated the same way as the other /api/pipe/* routes (one shared
 * bearer token, see contacts.ts). Mirrors the web builder's server actions
 * in src/app/(app)/offers/{actions,who/actions}.ts, but resolves the brand
 * from the request instead of a staff session.
 *
 * Deliberately narrower than the web UI in one place: deletePipeOffer only
 * hard-deletes an untouched draft. A sent, signed, or paid quote must be
 * archived (setPipeOfferStatus), never deleted — archiving preserves the
 * e-signature and payment trail; a hard delete would destroy it.
 */

export class PipeOfferError extends Error {}

const OFFER_STATUSES = ["draft", "sent", "accepted", "rejected", "completed", "archived"] as const;
export type PipeOfferStatus = (typeof OFFER_STATUSES)[number];

function isPipeOfferStatus(value: unknown): value is PipeOfferStatus {
  return typeof value === "string" && (OFFER_STATUSES as readonly string[]).includes(value);
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

const LIST_SELECT = {
  id: true,
  offerCode: true,
  slug: true,
  kind: true,
  status: true,
  totalOneTime: true,
  totalRecurring: true,
  onboardingFee: true,
  publicToken: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  client: { select: { id: true, name: true, email: true, company: true } },
} as const;

function presentOffer(row: Prisma.QuoteGetPayload<{ select: typeof LIST_SELECT }>) {
  return {
    id: row.id,
    offerCode: row.offerCode,
    slug: row.slug,
    kind: row.kind,
    status: row.status,
    totalOneTime: row.totalOneTime.toNumber(),
    totalRecurring: row.totalRecurring.toNumber(),
    onboardingFee: row.onboardingFee.toNumber(),
    hasPublicLink: Boolean(row.publicToken),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    client: row.client,
  };
}

export async function listPipeOffers(args: {
  actorUserId: string;
  brand: string;
  status?: string;
  query?: string;
}) {
  const brand = await resolveBrand(args.brand);
  const status = args.status && isPipeOfferStatus(args.status) ? args.status : undefined;
  const q = args.query?.trim();
  const rows = await prisma.quote.findMany({
    where: {
      brandId: brand.id,
      ...(status ? { status } : {}),
      ...(q
        ? {
            client: {
              is: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { company: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: LIST_SELECT,
  });
  return rows.map(presentOffer);
}

export async function getPipeOffer(args: { actorUserId: string; brand: string; offerId: string }) {
  const brand = await resolveBrand(args.brand);
  const quote = await prisma.quote.findFirst({
    where: { id: args.offerId, brandId: brand.id },
    select: { ...LIST_SELECT, snapshotJson: true, engagement: { select: { signedAt: true } } },
  });
  if (!quote) throw new PipeOfferError("Offer not found.");
  return { ...presentOffer(quote), snapshot: quote.snapshotJson, signedAt: quote.engagement?.signedAt?.toISOString() ?? null };
}

export type CreatePipeOfferInput = { brand: string; kind: string; contactIds: string[] };

export function parseCreatePipeOfferInput(body: unknown): CreatePipeOfferInput {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const brand = typeof raw.brand === "string" ? raw.brand.trim() : "";
  const kind = typeof raw.kind === "string" ? raw.kind.trim() : "";
  const rawIds = raw.contactIds ?? raw.contact_ids;
  const contactIds = Array.isArray(rawIds)
    ? [...new Set(rawIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];
  if (!brand) throw new RangeError("brand is required");
  if (!isOfferKindKey(kind)) throw new RangeError("kind must be one of the known offer types");
  if (contactIds.length === 0) throw new RangeError("contactIds must include at least one existing contact");
  return { brand, kind, contactIds };
}

export async function createPipeOffer(args: { actorUserId: string; input: CreatePipeOfferInput }) {
  const brand = await resolveBrand(args.input.brand);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: args.actorUserId });
  const kind = args.input.kind as OfferKindKey;

  const contacts = await withBrandDataTransaction(context, (transaction) =>
    transaction.contact.findMany({
      where: { brandId: brand.id, id: { in: args.input.contactIds } },
      select: { id: true, name: true, email: true, company: true },
    }),
  );
  if (contacts.length === 0) throw new PipeOfferError("No matching contact found for this brand.");

  const ordered = args.input.contactIds
    .map((id) => contacts.find((contact) => contact.id === id))
    .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));
  const primary = ordered[0];
  const email = (primary.email ?? "").trim().toLowerCase() || `${primary.id}@contacts.local`;

  const client = await prisma.quoteClient.create({
    data: { brandId: brand.id, name: primary.name, email, company: primary.company },
    select: { id: true },
  });

  const quote = await prisma.quote.create({
    data: {
      brandId: brand.id,
      slug: offerSlug(primary.name),
      clientId: client.id,
      kind,
      status: "draft",
      snapshotJson: { kind, contactIds: ordered.map((contact) => contact.id) },
    },
    select: LIST_SELECT,
  });

  return presentOffer(quote);
}

export type UpdatePipeOfferPatch = {
  assessment?: unknown;
  pricing?: unknown;
  isTestProposal?: boolean;
};

export async function updatePipeOfferDraft(args: {
  actorUserId: string;
  brand: string;
  offerId: string;
  patch: UpdatePipeOfferPatch;
}) {
  const brand = await resolveBrand(args.brand);
  const existing = await prisma.quote.findFirst({
    where: { id: args.offerId, brandId: brand.id },
    select: { id: true, status: true, snapshotJson: true, kind: true },
  });
  if (!existing) throw new PipeOfferError("Offer not found.");
  if (existing.status === "archived") throw new PipeOfferError("This offer is archived.");

  const previous =
    existing.snapshotJson && typeof existing.snapshotJson === "object"
      ? (existing.snapshotJson as Record<string, unknown>)
      : {};
  const catalogAssessment = await materializeProposalCatalog(brand.id, args.patch.assessment ?? previous.assessment);
  const assessment = await materializeAgreementTemplate(brand.id, catalogAssessment);
  const snapshot = asJsonObject({
    ...previous,
    kind: existing.kind,
    assessment,
    pricing: args.patch.pricing ?? previous.pricing,
    isTestProposal: args.patch.isTestProposal ?? previous.isTestProposal,
  });

  const quote = await prisma.quote.update({
    where: { id: existing.id },
    data: { snapshotJson: snapshot },
    select: LIST_SELECT,
  });
  return presentOffer(quote);
}

export async function setPipeOfferStatus(args: {
  actorUserId: string;
  brand: string;
  offerId: string;
  status: string;
}) {
  const brand = await resolveBrand(args.brand);
  if (!isPipeOfferStatus(args.status)) throw new RangeError("Invalid offer status.");

  const quote = await prisma.quote.findFirst({
    where: { id: args.offerId, brandId: brand.id },
    select: {
      id: true,
      sentAt: true,
      firstSentAt: true,
      publicToken: true,
      engagement: { select: { signedAt: true } },
    },
  });
  if (!quote) throw new PipeOfferError("Offer not found.");

  const revokePublicLink = args.status === "archived" && !quote.engagement?.signedAt;
  const updated = await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: args.status,
      ...(revokePublicLink ? { publicToken: null } : {}),
      ...(args.status === "sent"
        ? { sentAt: new Date(), firstSentAt: quote.firstSentAt ?? quote.sentAt ?? new Date(), lastSentAt: new Date() }
        : {}),
    },
    select: LIST_SELECT,
  });
  return presentOffer(updated);
}

/** Archive is the safe default: it preserves the row. Use only for a quote that is done, not wanted, or superseded. */
export async function archivePipeOffer(args: { actorUserId: string; brand: string; offerId: string }) {
  return setPipeOfferStatus({ ...args, status: "archived" });
}

/**
 * Hard delete, permitted ONLY for an untouched draft (never sent, no
 * engagement). A sent/signed/paid quote carries an e-signature and payment
 * trail that must never be destroyed; archivePipeOffer is the only path for
 * those, same rule a human reviewer would apply.
 */
export async function deletePipeOfferDraft(args: { actorUserId: string; brand: string; offerId: string }) {
  const brand = await resolveBrand(args.brand);
  const quote = await prisma.quote.findFirst({
    where: { id: args.offerId, brandId: brand.id },
    select: { id: true, status: true, sentAt: true, engagement: { select: { id: true } } },
  });
  if (!quote) throw new PipeOfferError("Offer not found.");
  if (quote.status !== "draft" || quote.sentAt || quote.engagement) {
    throw new PipeOfferError(
      "This offer has been sent, signed, or paid, or is otherwise not a plain draft. Archive it instead of deleting it.",
    );
  }
  await prisma.quote.delete({ where: { id: quote.id } });
  return { id: quote.id, deleted: true };
}

export { PipeBrandError };
