import "server-only";

import { z } from "zod";
import { slugifyTagKey } from "@/lib/contacts/tags";

const tier = z.enum(["maintain", "improve", "grow"]);
const text = z.string().max(100_000);
const packageNames = z.object({
  grow: z.string().max(40),
  improve: z.string().max(40),
  maintain: z.string().max(40),
});
const money = z.number().finite().nonnegative();
const mediaUrl = z.string().refine((value) => {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
});
const button = z.object({
  label: text, icon: z.string(), iconPlacement: z.enum(["none", "start", "end"]), visible: z.boolean(),
});
const option = z.object({
  id: z.string(), name: text, description: text, monthlyPrice: money,
  showInProposal: z.boolean(), archived: z.boolean(), applicable: z.boolean().optional(),
  realEstateSpecific: z.boolean().optional(),
  billingCadence: z.enum(["monthly", "one-time"]).optional(),
  includedPlacement: z.enum(["main", "included"]).optional(),
  packageIds: z.array(tier).optional(),
});
const bonus = z.object({
  id: z.string(), name: text, description: text, archived: z.boolean(),
  applicable: z.boolean().optional(), realEstateSpecific: z.boolean().optional(),
  billingCadence: z.enum(["monthly", "one-time"]).optional(),
  includedPlacement: z.enum(["main", "included"]).optional(),
  defaultPackageIds: z.array(tier).optional(),
  addOnPrice: money.optional(),
  addOnPackageIds: z.array(tier).optional(),
});

// Deliberately allowlisted at every object boundary. New staff fields must not
// silently become public merely because they are added to a saved assessment.
const publicAssessmentSchema = z.object({
  servicesInitialized: z.boolean().optional(),
  bookSetType: z.enum(["", "real-estate-only", "mixed-books", "other-business", "unknown"]).optional(),
  booksOverTwoMonthsBehind: z.boolean().nullable().optional(),
  cleanupStartMonth: z.string().optional(),
  cleanupEndMonth: z.string().optional(),
  historicalCleanupPeriods: z.array(z.object({
    id: z.string(), year: z.number().int(), startMonth: z.number().int().min(1).max(12),
    endMonth: z.number().int().min(1).max(12), platform: z.enum(["qbo", "stessa"]).optional(),
  })).default([]),
  waiveOnboardingFee: z.boolean().optional(),
  onboardingFeeOverride: money.nullable().optional(),
  showOriginalOneTimePrices: z.boolean().optional(),
  annualSavingsPercent: z.number().min(0).max(100).optional(),
  packageNames: packageNames.optional(),
  includeConditionalStessaMigration: z.boolean().optional(),
  includeTaxPreparerCoordinationCall: z.boolean().optional(),
  includePropertyLevelReportingSetup: z.boolean().optional(),
  includeDocumentOrganizationSetup: z.boolean().optional(),
  includeQuarterlyFinancialReview: z.boolean().optional(),
  includeDoubleHqClientPortal: z.boolean().optional(),
  includeRealEstateChartOfAccounts: z.boolean().optional(),
  includeNewQuickBooksFileSetup: z.boolean().optional(),
  includeRegisteredAgentService: z.boolean().optional(),
  bonusPackageSelections: z.record(z.string(), z.array(tier)).optional(),
  additionalOptions: z.array(option).default([]),
  bonuses: z.array(bonus).default([]),
  featuredImageUrl: mediaUrl.optional(), featuredVideoUrl: mediaUrl.optional(), featuredMediaId: z.string().optional(),
  introHeadline: text.optional(), introBody: text.optional(),
  heroMediaButton: button.optional(), heroContinueButton: button.optional(),
  proposalTheme: z.string().optional(), proposalMode: z.enum(["light", "dark"]).optional(),
  agreementTemplateName: text.optional(), agreementTemplateContent: text.optional(),
  ongoingBookkeepingPlatform: z.enum(["qbo", "stessa"]).optional(),
  platformMigrationEnabled: z.boolean().optional(),
});

const price = z.object({ monthly: money });
const publishedPricingSchema = z.object({ maintain: price, improve: price, grow: price });
const person = z.object({ firstName: z.string().default(""), lastName: z.string().default(""), email: z.string().default("") });

export type PublicProposalPricing = z.infer<typeof publishedPricingSchema>;
export type PublicCatalogCopy = ReadonlyMap<string, { clientBenefit: string; internalDescription: string }>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function catalogCopyFromRows(
  rows: Array<{
    offerKey?: string | null;
    code?: string | null;
    name?: string | null;
    clientBenefit?: string | null;
    internalDescription?: string | null;
  }>,
): PublicCatalogCopy {
  const map = new Map<string, { clientBenefit: string; internalDescription: string }>();
  for (const item of rows) {
    const key = item.offerKey || slugifyTagKey(item.code || item.name || "");
    if (!key) continue;
    map.set(key, {
      clientBenefit: item.clientBenefit ?? "",
      internalDescription: item.internalDescription ?? "",
    });
  }
  return map;
}

function remapPublicDescription<T extends { id: string; description: string }>(
  items: T[],
  catalogCopy?: PublicCatalogCopy,
): T[] {
  if (!catalogCopy) return items;
  return items.map((item) => {
    const row = catalogCopy.get(item.id);
    if (!row) return item;
    return { ...item, description: row.clientBenefit };
  });
}

export function toPublicBookkeepingProposal(
  snapshotValue: unknown,
  catalogCopy?: PublicCatalogCopy,
) {
  const snapshot = record(snapshotValue);
  const contact = record(snapshot.contactInfo);
  const primary = record(contact.primaryContact);
  const owners = Array.isArray(contact.owners) ? contact.owners.map(record) : [];
  const selectedPerson = primary.sameAsOwner === true
    ? owners.find((owner) => owner.id === primary.ownerId) ?? primary
    : primary;
  const publicPerson = person.parse(selectedPerson);
  const assessment = publicAssessmentSchema.parse(snapshot.assessment);
  return {
    assessment: {
      ...assessment,
      additionalOptions: remapPublicDescription(assessment.additionalOptions, catalogCopy),
      bonuses: remapPublicDescription(assessment.bonuses, catalogCopy),
    },
    pricing: publishedPricingSchema.parse(snapshot.pricing),
    contactInfo: {
      companyName: typeof contact.companyName === "string" ? contact.companyName : "",
      owners: [] as Array<never>,
      primaryContact: { ...publicPerson, sameAsOwner: false as const, ownerId: "", phone: "", role: "" },
    },
  };
}

export type PublicBookkeepingProposal = ReturnType<typeof toPublicBookkeepingProposal>;

const hourlyOfferSchema = z.object({
  catalogItemLabel: z.string(),
  quantity: z.number().finite().nonnegative(),
  unitPrice: z.number().finite().nonnegative(),
  intakeFee: z.number().finite().nonnegative(),
  subtotal: z.number().finite().nonnegative(),
  total: z.number().finite().nonnegative(),
  amountDueNow: z.number().finite().nonnegative(),
});

function publicHourlyPerson(snapshotValue: unknown) {
  const snapshot = record(snapshotValue);
  const contact = record(snapshot.contactInfo);
  const primary = record(contact.primaryContact);
  const owners = Array.isArray(contact.owners) ? contact.owners.map(record) : [];
  const selectedPerson = primary.sameAsOwner === true
    ? owners.find((owner) => owner.id === primary.ownerId) ?? primary
    : primary;
  const publicPerson = person.parse(selectedPerson);
  const companyName = typeof contact.companyName === "string" ? contact.companyName : "";
  const name = [publicPerson.firstName, publicPerson.lastName].filter(Boolean).join(" ").trim();
  return {
    companyName,
    name: name || companyName,
    email: publicPerson.email,
  };
}

export function toPublicHourlyProposal(input: {
  snapshot: unknown;
  checkout: unknown;
  brand: { name: string; accent: string | null };
  agreementText: string;
  flags: {
    proposalToken: string;
    engagementId: string | null;
    isTestProposal: boolean;
    isStaffPreview?: boolean;
    alreadySigned: boolean;
    kindLabel: string;
  };
}) {
  const personInfo = publicHourlyPerson(input.snapshot);
  const offer = hourlyOfferSchema.parse(input.checkout);
  return {
    proposalToken: input.flags.proposalToken,
    engagementId: input.flags.engagementId,
    isTestProposal: input.flags.isTestProposal,
    isStaffPreview: input.flags.isStaffPreview,
    kindLabel: input.flags.kindLabel,
    clientName: personInfo.companyName || personInfo.name,
    brandName: input.brand.name,
    brandAccent: input.brand.accent,
    contact: { name: personInfo.name, email: personInfo.email },
    offer: {
      catalogItemLabel: offer.catalogItemLabel,
      quantity: offer.quantity,
      unitPrice: offer.unitPrice,
      intakeFee: offer.intakeFee,
      subtotal: offer.subtotal,
      total: offer.total,
      amountDueNow: offer.amountDueNow,
    },
    agreementText: input.agreementText,
    alreadySigned: input.flags.alreadySigned,
  };
}

export type PublicHourlyProposal = ReturnType<typeof toPublicHourlyProposal>;
