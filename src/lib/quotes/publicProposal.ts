import "server-only";

import { z } from "zod";
import { slugifyTagKey } from "@/lib/contacts/tags";
import { toPublicAccountInventory, type PublicAccountInventory } from "@/lib/quotes/accountInventory";
import {
  hasComplexitySelection,
  toPublicComplexityWhy,
  type ComplexityPublicWhy,
} from "@/lib/quotes/complexityDrivers";
import {
  normalizeDesktopMigrationSelection,
  toPublicDesktopMigration,
} from "@/lib/quotes/desktopMigration";
import { desktopMigrationChoiceLabel } from "@/lib/quotes/desktopMigrationWiring";
import {
  isServiceStartMonth,
  readCreditCarryover,
} from "@/lib/quotes/serviceStart";
import {
  buildCleanupInstallments,
  cleanupWeeksBetween,
  normalizeCleanupPlan,
  type CleanupInstallmentDue,
  type CleanupPaymentPlan,
} from "@/lib/quotes/cleanupPlan";
import {
  asCompanyBundleSnapshot,
  buildCompanyBundleSnapshot,
  hasCompanyBundle,
  resolveBundlePricingOptions as resolveCanonicalBundlePricingOptions,
  toPublicCompanyBundleMap,
  type BundlePricingOptions,
  type PublicCompanyBundleMap,
} from "@/lib/quotes/companyBundle";
import { effectiveAssessment } from "@/app/(app)/offers/builder/effectiveAssessment";
import type { AssessmentState } from "@/app/(app)/offers/builder/ProposalCreationWorkspaceDemo";
import { readRenderedOptionCopy } from "@/lib/quotes/promiseCheck";

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
  required: z.boolean().optional(),
  /**
   * Spec 05 staff marker for the legacy flat Desktop → Online migration
   * option. Whitelisted (like the Spec 02/03 staff knobs the public page
   * needs) so the public page and the select route suppress the flat
   * option exactly like the staff preview — otherwise a role-marked row
   * would stack with the sized migration after publish. Absent on legacy
   * rows, so legacy payloads stay byte-identical.
   */
  role: z.enum(["desktop-migration"]).optional(),
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
  firstPaymentCredit: money.optional(),
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
  contractFollowsPayment: z.boolean().optional(),
  ongoingBookkeepingPlatform: z.enum(["qbo", "stessa", "sage"]).optional(),
  platformMigrationEnabled: z.boolean().optional(),
  /**
   * Spec 05 migration choice only — the money knobs (years, add-ons,
   * overrides) never publish. zod strips every other key, so the stored
   * selection's overrides cannot leak. The choice lets the public page
   * suppress the legacy flat option exactly like the staff preview.
   */
  desktopMigration: z.object({ choice: z.enum(["fresh_start", "full_history"]).nullable() }).nullable().optional(),
});

const price = z.object({ monthly: money });
const publishedPricingSchema = z.object({ maintain: price, improve: price, grow: price });
// Spec 07 frozen support copy: only the client-facing title/meaning/emphasis
// cross — never the version plumbing or anything else on the snapshot.
const supportLevelCopySchema = z.object({ title: z.string(), meaning: z.string(), emphasis: z.string() });
const supportCopySchema = z.object({ version: z.number(), levels: z.record(z.string(), supportLevelCopySchema) });
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
  renderedCopy?: Record<string, string> | null,
): T[] {
  // A published frozen copy wins over the live catalog: the client keeps
  // seeing the wording frozen at publish time even after a catalog edit. An
  // id missing from the frozen copy keeps its stored description (never the
  // live catalog). Without the frozen key the live remap runs as before.
  if (renderedCopy) {
    return items.map((item) => {
      const frozen = renderedCopy[item.id];
      if (frozen === undefined) return item;
      return { ...item, description: frozen };
    });
  }
  if (!catalogCopy) return items;
  return items.map((item) => {
    const row = catalogCopy.get(item.id);
    if (!row) return item;
    return { ...item, description: row.clientBenefit };
  });
}

/**
 * Resolve the Spec 02 bundle options for a stored assessment: the
 * per-proposal `bundlePricingOptions` override wins, then the template
 * `bundlePricingDefaults` applied to the proposal, then the brand catalog
 * `new-quickbooks-file` price (when above zero), then the proposed defaults.
 * Never hard-codes amounts here. Delegates to the one canonical resolver.
 */
export function resolveAssessmentBundlePricingOptions(assessment: unknown): BundlePricingOptions {
  return resolveCanonicalBundlePricingOptions(assessment);
}

/**
 * Whitelisted per-tier public bundle for a stored snapshot, or null for
 * legacy proposals without one. Read from the snapshot's one published
 * bundle object (the same object checkout, the agreement route and the
 * freeze-select route resolve), so the public per-company lines add up to
 * the published monthly of each tier. Recomputed only as a fallback for old
 * snapshots that predate the bundle wiring. Raw companies (account ids,
 * sources) never leave this function; only whitelisted names and amounts do.
 */
export function publicCompanyBundleForSnapshot(snapshotValue: unknown): PublicCompanyBundleMap | null {
  const snapshot = record(snapshotValue);
  const rawAssessment = record(snapshot.assessment);
  if (!hasCompanyBundle(rawAssessment)) return null;
  const stored = asCompanyBundleSnapshot(record(snapshot.pricing).companyBundle);
  if (stored) return toPublicCompanyBundleMap(rawAssessment.companies, stored);
  const bundle = buildCompanyBundleSnapshot({
    companies: rawAssessment.companies,
    baseAssessment: effectiveAssessment(rawAssessment as unknown as AssessmentState),
    options: resolveAssessmentBundlePricingOptions(rawAssessment),
  });
  return toPublicCompanyBundleMap(rawAssessment.companies, bundle);
}

export type { ComplexityPublicWhy };

/** Per-tier Spec 03 "Why this price" lists; null per tier means legacy (no lines stored). */
export type ComplexityWhyByTier = {
  maintain: ComplexityPublicWhy[] | null;
  improve: ComplexityPublicWhy[] | null;
  grow: ComplexityPublicWhy[] | null;
};

/**
 * Spec 03 client-facing per-tier "Why this price" lists for a stored
 * snapshot, or null for legacy proposals without a complexity selection.
 *
 * Read from the published snapshot's per-tier priced lines — the same
 * objects checkout and the agreement read — so the public page never
 * recomputes driver money and the Why list can show the SELECTED tier tab's
 * amounts. Only labels, plain reasons and monthly amounts leave this
 * function (the contract's whitelist); an included (or waiting-on-a-line)
 * driver publishes `monthly: null` in every tier.
 */
export function publicComplexityWhyForSnapshot(snapshotValue: unknown): ComplexityPublicWhy[] | null {
  const snapshot = record(snapshotValue);
  const rawAssessment = record(snapshot.assessment);
  if (!hasComplexitySelection(rawAssessment.complexity)) return null;
  const pricing = record(snapshot.pricing);
  const maintain = record(pricing.maintain);
  const stored = record(maintain.complexity);
  if (!Array.isArray(stored.lines)) return null;
  return toPublicComplexityWhy(stored.lines);
}

/**
 * Per-tier sibling of `publicComplexityWhyForSnapshot`: the whitelisted Why
 * list for EACH tier tab, read from that tier's stored priced lines. All
 * tiers are written by one snapshot version, so either every tier carries
 * lines or the snapshot predates the wiring — a missing maintain-tier lines
 * array means legacy and the whole map is null.
 */
export function publicComplexityWhyByTierForSnapshot(snapshotValue: unknown): ComplexityWhyByTier | null {
  const snapshot = record(snapshotValue);
  const rawAssessment = record(snapshot.assessment);
  if (!hasComplexitySelection(rawAssessment.complexity)) return null;
  const pricing = record(snapshot.pricing);
  const maintainStored = record(record(pricing.maintain).complexity);
  if (!Array.isArray(maintainStored.lines)) return null;
  const forTier = (tier: "maintain" | "improve" | "grow"): ComplexityPublicWhy[] | null => {
    const stored = record(record(pricing[tier]).complexity);
    if (!Array.isArray(stored.lines)) return toPublicComplexityWhy(maintainStored.lines);
    return toPublicComplexityWhy(stored.lines);
  };
  return { maintain: forTier("maintain"), improve: forTier("improve"), grow: forTier("grow") };
}

/**
 * Whitelisted Spec 04 wrap-up plan for a stored snapshot, or null for
 * legacy snapshots without one. Only client-visible fields leave this
 * function: the caught-up-through month, the wrap-up date, the payment plan,
 * and the installment preview (label, amount, due). The staff-only fields —
 * start date, wrap-up source, installment due dates — never publish.
 */
export type PublicCleanupInstallment = {
  label: string;
  amountCents: number;
  due: CleanupInstallmentDue;
};

export type PublicCleanupPlan = {
  caughtUpThrough: string;
  wrapUpDate: string;
  paymentPlan: CleanupPaymentPlan;
  installments: PublicCleanupInstallment[];
  /**
   * Whole weeks between the snapshot plan start and wrap-up (rounded up).
   * The live pre-selection view shows this length instead of the wrap-up
   * calendar date, which would go stale before the client selects. The
   * staff-only start date itself never publishes.
   */
  wrapUpWeeks: number;
};

function isValidPeriodLike(value: unknown): value is { startMonth: number; endMonth: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const period = value as Record<string, unknown>;
  return (
    Number.isInteger(period.startMonth) &&
    Number.isInteger(period.endMonth) &&
    (period.startMonth as number) >= 1 &&
    (period.endMonth as number) >= (period.startMonth as number) &&
    (period.endMonth as number) <= 12
  );
}

export function publicCleanupPlanForSnapshot(snapshotValue: unknown): PublicCleanupPlan | null {
  const snapshot = record(snapshotValue);
  const rawAssessment = record(snapshot.assessment);
  if (!rawAssessment.cleanupPlan || typeof rawAssessment.cleanupPlan !== "object") return null;
  const periods = Array.isArray(rawAssessment.historicalCleanupPeriods)
    ? rawAssessment.historicalCleanupPeriods.filter(isValidPeriodLike)
    : [];
  const backlogMonths = periods.reduce((total, period) => total + (period.endMonth - period.startMonth + 1), 0);
  const pricing = record(snapshot.pricing);
  const maintain = record(pricing.maintain);
  const maintainMonthly = typeof maintain.monthly === "number" && Number.isFinite(maintain.monthly)
    ? Math.max(0, maintain.monthly)
    : 0;
  const complexity = record(maintain.complexity);
  const complexityPerMonth = typeof complexity.cleanupPerMonthTotal === "number" && Number.isFinite(complexity.cleanupPerMonthTotal)
    ? Math.max(0, complexity.cleanupPerMonthTotal)
    : 0;
  // Same estimate the stored checkout freezes (base + Spec 03 add), summed
  // over every snapshot period — the client refines it by selecting periods.
  const totalCents = Math.round((maintainMonthly + complexityPerMonth) * backlogMonths * 100);
  const plan = normalizeCleanupPlan(rawAssessment.cleanupPlan, { backlogMonths });
  return {
    caughtUpThrough: plan.caughtUpThrough,
    wrapUpDate: plan.wrapUpDate,
    wrapUpWeeks: cleanupWeeksBetween(plan.startDate, plan.wrapUpDate),
    paymentPlan: plan.paymentPlan,
    installments: buildCleanupInstallments(totalCents, plan).map((installment) => ({
      label: installment.label,
      amountCents: installment.amountCents,
      due: installment.due,
    })),
  };
}

/**
 * Whitelisted Spec 04 plan input for the select route's checkout
 * reconstruction. The public assessment schema strips `cleanupPlan`, so the
 * route carries these five staff-snapshot fields back in explicitly — same
 * trust level as the companies it already carries. Refresh/normalize at
 * checkout validates every field; junk still yields a usable plan.
 */
export function storedCleanupPlanInputForSnapshot(snapshotValue: unknown): Record<string, unknown> | null {
  const snapshot = record(snapshotValue);
  const rawAssessment = record(snapshot.assessment);
  const raw = record(rawAssessment.cleanupPlan);
  if (Object.keys(raw).length === 0) return null;
  const picked: Record<string, unknown> = {};
  for (const key of ["caughtUpThrough", "startDate", "wrapUpDate", "wrapUpSource", "paymentPlan"]) {
    if (raw[key] !== undefined) picked[key] = raw[key];
  }
  return Object.keys(picked).length > 0 ? picked : null;
}

/**
 * Whitelisted Spec 05 priced migration for a stored snapshot, or null for
 * legacy snapshots without one. Read from the snapshot's one priced
 * `pricing.desktopMigration` object — the same object checkout and the
 * agreement route read — so the public block, checkout and agreement can
 * never disagree. Only labels and amounts cross.
 */
export type PublicDesktopMigration = {
  lines: Array<{ label: string; amount: number }>;
  total: number;
};

/**
 * Whitelisted Spec 07 frozen support copy for a stored snapshot, or null for
 * legacy snapshots without one. Only title/meaning/emphasis per level cross
 * (validated by the schema above); anything malformed reads as legacy.
 */
export type PublicSupportCopy = z.infer<typeof supportCopySchema>;

export function publicSupportCopyForSnapshot(snapshotValue: unknown): PublicSupportCopy | null {
  const stored = record(snapshotValue).supportCopy;
  const parsed = supportCopySchema.safeParse(stored);
  if (!parsed.success || Object.keys(parsed.data.levels).length === 0) return null;
  return parsed.data;
}

export function publicDesktopMigrationForSnapshot(snapshotValue: unknown): PublicDesktopMigration | null {
  const snapshot = record(snapshotValue);
  const pricing = record(snapshot.pricing);
  return toPublicDesktopMigration(pricing.desktopMigration);
}

/**
 * Spec 05 choice label for a stored snapshot, or null for legacy snapshots
 * without a choice. Read from the stored assessment selection (the money
 * knobs stay staff-only); the priced object above carries lines + total.
 */
export function publicDesktopMigrationChoiceForSnapshot(snapshotValue: unknown): string | null {
  const snapshot = record(snapshotValue);
  const selection = normalizeDesktopMigrationSelection(record(snapshot.assessment).desktopMigration);
  if (selection.choice === null) return null;
  if (!publicDesktopMigrationForSnapshot(snapshotValue)) return null;
  return desktopMigrationChoiceLabel(selection.choice);
}

/**
 * Whitelisted Spec 06 service start month for a stored snapshot, or null for
 * legacy snapshots without one. Only a valid "YYYY-MM" crosses — staff-only
 * junk never publishes, and legacy payloads stay byte-identical.
 */
export function publicServiceStartMonthForSnapshot(snapshotValue: unknown): string | null {
  const rawAssessment = record(record(snapshotValue).assessment);
  return isServiceStartMonth(rawAssessment.serviceStartMonth) ? rawAssessment.serviceStartMonth : null;
}

/**
 * Whitelisted Spec 06 client-readable credit reason for a stored snapshot, or
 * null when none was stored. Trimmed and capped; empty or non-string reasons
 * never publish.
 */
export function publicFirstPaymentCreditReasonForSnapshot(snapshotValue: unknown): string | null {
  const rawAssessment = record(record(snapshotValue).assessment);
  const reason = rawAssessment.firstPaymentCreditReason;
  if (typeof reason !== "string") return null;
  const trimmed = reason.trim().slice(0, 500);
  return trimmed ? trimmed : null;
}

/**
 * Whitelisted Spec 06 remaining-credit subset for a stored checkout or
 * acceptance (the frozen selection the client approved, or the acceptance
 * frozen at signing): only the amount and its reason cross — never the
 * applied/due internals. Null when no excess remains, so the receipt can
 * show "Remaining credit $X applied to your next invoice." The receipt
 * reads the acceptance first, then the stored checkout.
 */
export type PublicCreditCarryover = {
  creditRemaining: number;
  creditRemainingReason: string;
};

export function publicCreditCarryoverForCheckout(checkoutValue: unknown): PublicCreditCarryover | null {
  return readCreditCarryover(checkoutValue);
}

/**
 * Whitelisted Spec 05 priced migration for the select route's checkout
 * reconstruction. The public pricing schema strips `pricing.desktopMigration`,
 * so carry the validated object back in — same trust level as the bundle
 * object the route already carries.
 */
export function storedDesktopMigrationForSnapshot(snapshotValue: unknown): PublicDesktopMigration | null {
  return publicDesktopMigrationForSnapshot(snapshotValue);
}

/**
 * Whitelisted Spec 03 complexity cleanup rate for the select route's
 * checkout reconstruction. The public pricing schema strips the priced
 * `maintain.complexity` object, so without this the real select flow always
 * stores `complexityCleanupAdd: undefined`. Only the per-month number the
 * checkout reads crosses — never the raw complexity selection.
 */
export function storedComplexityCleanupPerMonthForSnapshot(snapshotValue: unknown): number {
  const snapshot = record(snapshotValue);
  const pricing = record(snapshot.pricing);
  const maintain = record(pricing.maintain);
  const complexity = record(maintain.complexity);
  const rate = complexity.cleanupPerMonthTotal;
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : 0;
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
  const accountInventory: PublicAccountInventory | null = toPublicAccountInventory(record(snapshot.assessment).accounts);
  const cleanupPlan = publicCleanupPlanForSnapshot(snapshotValue);
  const desktopMigration = publicDesktopMigrationForSnapshot(snapshotValue);
  // Spec 06 start month + credit reason; spread only when present so legacy
  // payloads stay byte-identical (the legacy toEqual test pins the shape).
  const serviceStartMonth = publicServiceStartMonthForSnapshot(snapshotValue);
  const firstPaymentCreditReason = publicFirstPaymentCreditReasonForSnapshot(snapshotValue);
  // Spec 07 frozen support copy; same conditional-spread rule as the plan.
  const supportCopy = publicSupportCopyForSnapshot(snapshotValue);
  // Spec 07 round 2 frozen option copy: when the snapshot carries it, the
  // public page renders those descriptions instead of the live catalog.
  const renderedCopy = readRenderedOptionCopy(snapshot);
  return {
    accountInventory,
    assessment: {
      ...assessment,
      ...(serviceStartMonth !== null ? { serviceStartMonth } : {}),
      ...(firstPaymentCreditReason !== null ? { firstPaymentCreditReason } : {}),
      additionalOptions: remapPublicDescription(assessment.additionalOptions, catalogCopy, renderedCopy),
      bonuses: remapPublicDescription(assessment.bonuses, catalogCopy, renderedCopy),
    },
    pricing: publishedPricingSchema.parse(snapshot.pricing),
    // Legacy proposals (no bundle) get null; `assessment.companies` itself
    // stays stripped by the allowlisted schema above.
    companyBundle: publicCompanyBundleForSnapshot(snapshotValue),
    // Legacy proposals (no complexity selection) get null; the raw selection
    // (names, overrides) never leaves the snapshot — only the whitelist above.
    complexityWhy: publicComplexityWhyForSnapshot(snapshotValue),
    // Spec 04 wrap-up plan; spread only when present so legacy payloads stay
    // byte-identical (the legacy toEqual test pins the full shape).
    ...(cleanupPlan !== null ? { cleanupPlan } : {}),
    // Spec 05 sized migration; same conditional-spread rule as the plan.
    ...(desktopMigration !== null ? { desktopMigration } : {}),
    // Spec 07 frozen support copy; null (legacy) omits the key entirely.
    ...(supportCopy !== null ? { supportCopy } : {}),
    // Per-tier Why lists for the tier tabs (selected tab's amounts); null for
    // legacy. `complexityWhy` stays as the maintain-tier alias.
    complexityWhyByTier: publicComplexityWhyByTierForSnapshot(snapshotValue),
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
