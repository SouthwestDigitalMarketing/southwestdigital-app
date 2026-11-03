import "server-only";

import { prisma } from "@/lib/prisma";
import { slugifyTagKey } from "@/lib/contacts/tags";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { PROPOSAL_PACKAGE_IDS, type PackageId } from "@/app/(app)/offers/builder/proposalPackageNames";
import { PipeBrandError, resolveBrand } from "./contacts";

/**
 * The shared service catalogue, reachable by the `pipe` terminal tool with the
 * same bearer token as the other /api/pipe/* routes.
 *
 * A proposal's service list is rebuilt from this catalogue on every save
 * (reconcileProposalAssessmentWithCatalog drops anything whose offerKey is not
 * an active catalogue row), so a service written only into one offer's snapshot
 * disappears the next time that offer is saved. Anything a quote must keep has
 * to exist here.
 *
 * For the same reason there is no delete: offers reference rows by offerKey.
 * archivePipeCatalogService flips `active` to false, which still removes the
 * service from DRAFT offers on their next save — published snapshots are frozen
 * and keep what they were published with.
 */

export class PipeCatalogError extends Error {}

const OFFER_SECTIONS = ["core-services", "included-services", "options", "hourly-services"] as const;
type OfferSection = (typeof OFFER_SECTIONS)[number];

const BILLING_CADENCES = ["monthly", "one-time", "no-charge"] as const;
type BillingCadence = (typeof BILLING_CADENCES)[number];

const SELECT = {
  id: true,
  name: true,
  code: true,
  offerKey: true,
  offerSection: true,
  defaultInclusion: true,
  defaultPrice: true,
  billingCadence: true,
  defaultPackageKeys: true,
  clientBenefit: true,
  internalDescription: true,
  applicabilityNote: true,
  priority: true,
  active: true,
  realEstateSpecific: true,
  productKind: true,
  createdAt: true,
  updatedAt: true,
} as const;

type Row = {
  id: string;
  name: string;
  code: string | null;
  offerKey: string | null;
  offerSection: string;
  defaultInclusion: string | null;
  defaultPrice: { toNumber(): number } | null;
  billingCadence: string;
  defaultPackageKeys: unknown;
  clientBenefit: string | null;
  internalDescription: string | null;
  applicabilityNote: string | null;
  priority: number;
  active: boolean;
  realEstateSpecific: boolean;
  productKind: string;
  createdAt: Date;
  updatedAt: Date;
};

function present(row: Row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    offerKey: row.offerKey,
    offerSection: row.offerSection,
    defaultInclusion: row.defaultInclusion,
    defaultPrice: row.defaultPrice ? row.defaultPrice.toNumber() : null,
    billingCadence: row.billingCadence,
    defaultPackageKeys: Array.isArray(row.defaultPackageKeys) ? row.defaultPackageKeys : [],
    clientBenefit: row.clientBenefit,
    internalDescription: row.internalDescription,
    applicabilityNote: row.applicabilityNote,
    priority: row.priority,
    active: row.active,
    realEstateSpecific: row.realEstateSpecific,
    productKind: row.productKind,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPipeCatalogServices(args: {
  actorUserId: string;
  brand: string;
  includeInactive?: boolean;
  query?: string;
}) {
  const brand = await resolveBrand(args.brand);
  const q = args.query?.trim();
  const rows = (await prisma.catalogService.findMany({
    where: {
      brandId: brand.id,
      ...(args.includeInactive ? {} : { active: true }),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
    select: SELECT,
  })) as Row[];
  return rows.map(present);
}

export type PipeCatalogServiceInput = {
  brand: string;
  name: string;
  offerKey: string | null;
  code: string | null;
  clientBenefit: string | null;
  internalDescription: string | null;
  applicabilityNote: string | null;
  defaultInclusion: "optional" | "included" | null;
  offerSection: OfferSection | null;
  defaultPrice: number | null;
  billingCadence: BillingCadence;
  defaultPackageKeys: PackageId[];
  priority: number;
};

function text(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function parsePipeCatalogServiceInput(body: unknown): PipeCatalogServiceInput {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const brand = text(raw.brand);
  const name = text(raw.name);
  if (!brand) throw new RangeError("brand is required");
  if (!name) throw new RangeError("name is required");

  const code = text(raw.code);
  const offerKey = slugifyTagKey(text(raw.offerKey) ?? code ?? name) || null;

  const rawInclusion = text(raw.defaultInclusion);
  const defaultInclusion =
    rawInclusion === "optional" || rawInclusion === "included" ? rawInclusion : null;

  const rawSection = text(raw.offerSection);
  const offerSection = OFFER_SECTIONS.includes(rawSection as OfferSection)
    ? (rawSection as OfferSection)
    : null;

  const rawCadence = text(raw.billingCadence);
  const billingCadence: BillingCadence = BILLING_CADENCES.includes(rawCadence as BillingCadence)
    ? (rawCadence as BillingCadence)
    : "monthly";

  let defaultPrice: number | null = null;
  if (raw.defaultPrice != null && raw.defaultPrice !== "") {
    const parsed = Number(raw.defaultPrice);
    if (!Number.isFinite(parsed) || parsed < 0) throw new RangeError("defaultPrice must be zero or greater");
    defaultPrice = parsed;
  }

  const requested = Array.isArray(raw.defaultPackageKeys) ? raw.defaultPackageKeys.map(String) : [];
  const defaultPackageKeys = PROPOSAL_PACKAGE_IDS.filter((id) => requested.includes(id));

  let priority = 500;
  if (raw.priority != null && raw.priority !== "") {
    const parsed = Number(raw.priority);
    if (!Number.isFinite(parsed)) throw new RangeError("priority must be a number");
    priority = Math.max(0, Math.round(parsed));
  }

  return {
    brand,
    name,
    offerKey,
    code,
    clientBenefit: text(raw.clientBenefit),
    internalDescription: text(raw.internalDescription),
    applicabilityNote: text(raw.applicabilityNote),
    defaultInclusion,
    offerSection,
    defaultPrice,
    billingCadence,
    defaultPackageKeys,
    priority,
  };
}

export async function createPipeCatalogService(args: {
  actorUserId: string;
  input: PipeCatalogServiceInput;
}) {
  const brand = await resolveBrand(args.input.brand);
  const { proposalCatalog, proposalPackageDefaults } = await getSchemaCapabilities();
  const input = args.input;

  if (input.code) {
    const clash = await prisma.catalogService.findFirst({
      where: { brandId: brand.id, code: input.code },
      select: { id: true },
    });
    if (clash) throw new PipeCatalogError("A service with that code already exists.");
  }
  if (proposalCatalog && input.offerKey) {
    const clash = await prisma.catalogService.findFirst({
      where: { brandId: brand.id, offerKey: input.offerKey },
      select: { id: true },
    });
    if (clash) throw new PipeCatalogError("A service with that offerKey already exists.");
  }

  const row = (await prisma.catalogService.create({
    data: {
      brandId: brand.id,
      name: input.name,
      // Mirrors the Services form: with no tags attached these are the fallbacks.
      category: "general",
      service: "cleanup",
      code: input.code,
      clientBenefit: input.clientBenefit,
      internalDescription: input.internalDescription,
      priority: input.priority,
      ...(proposalCatalog
        ? {
            offerKey: input.offerKey,
            defaultInclusion: input.defaultInclusion,
            defaultPrice: input.defaultPrice,
            billingCadence: input.billingCadence,
            applicabilityNote: input.applicabilityNote,
            ...(input.offerSection ? { offerSection: input.offerSection } : {}),
            ...(proposalPackageDefaults ? { defaultPackageKeys: input.defaultPackageKeys } : {}),
          }
        : {}),
    },
    select: SELECT,
  })) as Row;
  return present(row);
}

export async function updatePipeCatalogService(args: {
  actorUserId: string;
  brand: string;
  id: string;
  patch: Partial<Omit<PipeCatalogServiceInput, "brand">>;
}) {
  const brand = await resolveBrand(args.brand);
  const { proposalCatalog, proposalPackageDefaults } = await getSchemaCapabilities();
  const existing = await prisma.catalogService.findFirst({
    where: { id: args.id, brandId: brand.id },
    select: { id: true },
  });
  if (!existing) throw new PipeCatalogError("Service not found.");

  const p = args.patch;
  const row = (await prisma.catalogService.update({
    where: { id: existing.id },
    data: {
      ...(p.name !== undefined ? { name: p.name } : {}),
      ...(p.code !== undefined ? { code: p.code } : {}),
      ...(p.clientBenefit !== undefined ? { clientBenefit: p.clientBenefit } : {}),
      ...(p.internalDescription !== undefined ? { internalDescription: p.internalDescription } : {}),
      ...(p.priority !== undefined ? { priority: p.priority } : {}),
      ...(proposalCatalog
        ? {
            ...(p.defaultInclusion !== undefined ? { defaultInclusion: p.defaultInclusion } : {}),
            ...(p.defaultPrice !== undefined ? { defaultPrice: p.defaultPrice } : {}),
            ...(p.billingCadence !== undefined ? { billingCadence: p.billingCadence } : {}),
            ...(p.applicabilityNote !== undefined ? { applicabilityNote: p.applicabilityNote } : {}),
            ...(p.offerSection ? { offerSection: p.offerSection } : {}),
            ...(proposalPackageDefaults && p.defaultPackageKeys !== undefined
              ? { defaultPackageKeys: p.defaultPackageKeys }
              : {}),
          }
        : {}),
    },
    select: SELECT,
  })) as Row;
  return present(row);
}

/**
 * Archive, never delete. Offers reference catalogue rows by offerKey, so a row
 * that disappears takes the service out of every draft offer that carries it on
 * that offer's next save. Published proposals keep their frozen snapshot.
 */
export async function archivePipeCatalogService(args: {
  actorUserId: string;
  brand: string;
  id: string;
}) {
  const brand = await resolveBrand(args.brand);
  const existing = await prisma.catalogService.findFirst({
    where: { id: args.id, brandId: brand.id },
    select: { id: true, active: true },
  });
  if (!existing) throw new PipeCatalogError("Service not found.");
  const row = (await prisma.catalogService.update({
    where: { id: existing.id },
    data: { active: false },
    select: SELECT,
  })) as Row;
  return present(row);
}

export { PipeBrandError };
