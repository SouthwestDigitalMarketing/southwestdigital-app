import "server-only";

import { z } from "zod";

const tier = z.enum(["maintain", "improve", "grow"]);
const text = z.string().max(100_000);
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
});
const bonus = z.object({
  id: z.string(), name: text, description: text, archived: z.boolean(),
  applicable: z.boolean().optional(), realEstateSpecific: z.boolean().optional(),
  billingCadence: z.enum(["monthly", "one-time"]).optional(),
  defaultPackageIds: z.array(tier).optional(),
});

// Deliberately allowlisted at every object boundary. New staff fields must not
// silently become public merely because they are added to a saved assessment.
const publicAssessmentSchema = z.object({
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
  annualSavingsPercent: z.number().min(0).max(100).optional(),
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function toPublicBookkeepingProposal(snapshotValue: unknown) {
  const snapshot = record(snapshotValue);
  const contact = record(snapshot.contactInfo);
  const primary = record(contact.primaryContact);
  const owners = Array.isArray(contact.owners) ? contact.owners.map(record) : [];
  const selectedPerson = primary.sameAsOwner === true
    ? owners.find((owner) => owner.id === primary.ownerId) ?? primary
    : primary;
  const publicPerson = person.parse(selectedPerson);
  return {
    assessment: publicAssessmentSchema.parse(snapshot.assessment),
    pricing: publishedPricingSchema.parse(snapshot.pricing),
    contactInfo: {
      companyName: typeof contact.companyName === "string" ? contact.companyName : "",
      owners: [],
      primaryContact: { ...publicPerson, sameAsOwner: false, ownerId: "", phone: "", role: "" },
    },
  };
}
