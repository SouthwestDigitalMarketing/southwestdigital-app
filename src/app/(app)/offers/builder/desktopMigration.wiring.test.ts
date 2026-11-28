import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import {
  applyOptionsTemplateSlice,
  desktopMigrationExtraFileNames,
  desktopMigrationSummaryText,
  desktopMigrationSuppressedNames,
  getProposalPricingSnapshotData,
  getProposalPricingSnapshotPricing,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import DesktopMigrationEditor from "./DesktopMigrationEditor";
import DesktopMigrationSummary from "./DesktopMigrationSummary";
import CompanyBundleSummary from "./CompanyBundleSummary";
import { effectiveAssessment } from "./effectiveAssessment";
import {
  asCompanyBundleSnapshot,
  normalizeCompanyBundle,
  resolveCompanyBundleForTier,
  companyBundleFeeLines,
  resolveBundlePricingOptions,
  type CompanyEntry,
} from "@/lib/quotes/companyBundle";
import {
  normalizeDesktopMigrationSelection,
  type DesktopMigrationSelection,
} from "@/lib/quotes/desktopMigration";
import {
  desktopMigrationFeeLabel,
  resolveDesktopMigrationPrice,
  withSizedMigrationFeeLines,
} from "@/lib/quotes/desktopMigrationWiring";
import {
  requiredOneTimeAddOnsForTier,
} from "@/lib/quotes/proposalServices";
import {
  storedDesktopMigrationForSnapshot,
  toPublicBookkeepingProposal,
} from "@/lib/quotes/publicProposal";
import { buildProposalCheckoutSummary } from "@/lib/engagements/proposalCheckout";
import {
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
  renderAgreementTemplate,
} from "@/lib/agreements/template";

function freshAssessment(): AssessmentState {
  let state: AssessmentState;
  function Capture() {
    state = useProposalAssessmentDemoState({ persist: false }).assessment;
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return state!;
}

function desktopCompany(id: string, name: string): CompanyEntry {
  return {
    id,
    name,
    ownQboFile: true,
    fileStatus: "desktop_to_online",
    locationsCount: 0,
    propertiesCount: 0,
    accounts: [],
    complexity: null,
  };
}

type TierId = "grow" | "improve" | "maintain";

const flatMigrationOption = {
  id: "migration",
  name: "QuickBooks Desktop to Online Migration",
  description: "Move from Desktop to Online.",
  monthlyPrice: 640,
  showInProposal: true,
  archived: false,
  billingCadence: "one-time" as const,
  packageIds: ["grow", "improve", "maintain"] as TierId[],
  required: true,
};

const roleMarkedFlatOption = {
  id: "flat-fee",
  name: "Migration flat fee",
  description: "Legacy flat migration row.",
  monthlyPrice: 640,
  showInProposal: true,
  archived: false,
  billingCadence: "one-time" as const,
  packageIds: ["maintain"] as TierId[],
  required: true,
  role: "desktop-migration" as const,
};

function assessmentFor(selection: DesktopMigrationSelection | undefined, extra: Partial<AssessmentState> = {}): AssessmentState {
  const fresh = freshAssessment();
  return {
    ...fresh,
    transactionBand: "500-999",
    historicalCleanupPeriods: [],
    companies: normalizeCompanyBundle([
      desktopCompany("main", "Main Co"),
      desktopCompany("b", "Beta LLC"),
    ]),
    additionalOptions: [{ ...flatMigrationOption }],
    ...(selection === undefined ? {} : { desktopMigration: selection }),
    ...extra,
  };
}

const contactInfo = {
  companyName: "Example LLC",
  owners: [],
  primaryContact: { firstName: "Alex", lastName: "Example", email: "alex@example.test" },
};

function publishedSnapshotFor(assessment: AssessmentState) {
  return {
    assessment: JSON.parse(JSON.stringify(assessment)),
    pricing: getProposalPricingSnapshotPricing(assessment),
    contactInfo: JSON.parse(JSON.stringify(contactInfo)),
    isTestProposal: false,
  };
}

/**
 * The real select-route reconstruction: the public payload strips the
 * bundle object, the migration object and the raw companies, so the route
 * carries them back in from the stored snapshot before checkout.
 */
function selectCheckout(snapshot: ReturnType<typeof publishedSnapshotFor>, tier: "maintain" | "improve" | "grow" = "maintain") {
  const publicProposal = toPublicBookkeepingProposal(snapshot);
  const storedAssessment = snapshot.assessment as Record<string, unknown>;
  const storedPricing = snapshot.pricing as Record<string, unknown>;
  const snapshotBundle = asCompanyBundleSnapshot(storedPricing.companyBundle);
  const storedMigration = storedDesktopMigrationForSnapshot(snapshot);
  return buildProposalCheckoutSummary(
    {
      assessment: {
        ...publicProposal.assessment,
        companies: storedAssessment.companies,
        bundlePricingOptions: storedAssessment.bundlePricingOptions,
        bundlePricingDefaults: storedAssessment.bundlePricingDefaults,
        desktopMigrationDefaults: storedAssessment.desktopMigrationDefaults,
      },
      pricing: {
        ...publicProposal.pricing,
        ...(snapshotBundle ? { companyBundle: snapshotBundle } : {}),
        ...(storedMigration ? { desktopMigration: storedMigration } : {}),
      },
      isTestProposal: false,
    },
    {
      tier,
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
    },
  );
}

/** Route-style agreement composition: the sized line lives in the company bucket only. */
function agreementFor(snapshot: ReturnType<typeof publishedSnapshotFor>, tier: "maintain" | "improve" | "grow" = "maintain") {
  const storedAssessment = snapshot.assessment as Record<string, unknown>;
  const assessment = { ...storedAssessment, additionalOptions: storedAssessment.additionalOptions ?? [] };
  const checkout = selectCheckout(snapshot, tier);
  const bundle = resolveCompanyBundleForTier({
    pricing: snapshot.pricing,
    packageId: tier,
    companies: storedAssessment.companies,
    baseAssessment: effectiveAssessment(assessment as unknown as AssessmentState),
    options: resolveBundlePricingOptions(assessment),
  });
  const choice = normalizeDesktopMigrationSelection(storedAssessment.desktopMigration).choice;
  const storedMigration = storedDesktopMigrationForSnapshot(snapshot);
  const sizedLine = choice !== null && storedMigration
    ? { label: desktopMigrationFeeLabel(choice === "fresh_start" ? "Fresh start" : "Full history"), amount: storedMigration.total }
    : null;
  const companyFeeLines = withSizedMigrationFeeLines(
    bundle ? companyBundleFeeLines(bundle) : undefined,
    sizedLine,
  );
  // The stored checkout selection carries the required ids (checkout
  // auto-adds them), exactly what the agreement route reads.
  const requiredOneTime = requiredOneTimeAddOnsForTier(assessment, checkout.selectedAdditionalOptionIds, tier);
  const text = renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, {
    brandName: "Southwest",
    clientName: "Example LLC",
    selectedTierLabel: "Maintain",
    onboardingFee: checkout.onboardingFee,
    hasCleanup: false,
    recurringMonthlyTotal: checkout.recurringMonthlyTotal,
    cleanupTotal: checkout.cleanupTotal,
    amountDueNow: checkout.amountDueNow,
    agreementTerm: "month-to-month",
    selectedCleanupPeriods: [],
    selectedAdditionalOptionNames: [],
    companyFeeLines,
    paymentScheduleVersion: 2,
    cleanupMonths: checkout.cleanupMonths,
    cleanupMonthlyRate: checkout.cleanupMonthlyRate,
    additionalOneTimeTotal: oneTime(checkout),
    requiredOneTime,
  });
  return { checkout, companyFeeLines: companyFeeLines ?? [], requiredOneTime, text };
}

function countOccurrences(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

/** Stored one-time total is always present on a built checkout. */
function oneTime(checkout: { additionalOneTimeTotal?: number }): number {
  return checkout.additionalOneTimeTotal ?? 0;
}

describe("spec 05 end to end: full history", () => {
  const selection: DesktopMigrationSelection = {
    choice: "full_history",
    historyYears: 3,
    payrollHistory: true,
    inventory: true,
  };

  it("carries one priced object from builder to snapshot (640 + 450 + 300 + 350 + 250)", () => {
    const assessment = assessmentFor(selection);
    const pricing = getProposalPricingSnapshotPricing(assessment) as Record<string, unknown>;
    const migration = pricing.desktopMigration as { lines: { label: string; amount: number }[]; total: number };
    expect(migration.total).toBe(1990);
    expect(migration.lines.map((line) => line.label)).toEqual([
      "Desktop migration — full history base",
      "Full history — 3 years × $150",
      "Volume factor (500-999)",
      "Payroll history",
      "Inventory",
      "1 additional Desktop file × $250",
      "Trial-balance tie-out (included)",
    ]);
    // The live builder price is the same object the snapshot publishes.
    expect(resolveDesktopMigrationPrice(assessment)?.total).toBe(1990);
    expect(desktopMigrationSummaryText(assessment)).toBe("Full history · $1,990");
    expect(desktopMigrationExtraFileNames(assessment)).toEqual(["Beta LLC"]);
    expect(desktopMigrationSuppressedNames(assessment)).toEqual([
      "QuickBooks Desktop to Online Migration",
    ]);
  });

  it("publishes only the choice (never overrides) and charges the total exactly once", () => {
    const assessment = assessmentFor({
      ...selection,
      overrides: { baseAmount: 700 },
    });
    const snapshot = publishedSnapshotFor(assessment);
    const stored = snapshot.pricing as Record<string, unknown>;
    expect((stored.desktopMigration as { total: number }).total).toBe(2050);
    const publicProposal = toPublicBookkeepingProposal(snapshot);
    expect(publicProposal.desktopMigration?.total).toBe(2050);
    expect(publicProposal.assessment.desktopMigration).toEqual({ choice: "full_history" });
    expect(JSON.stringify(publicProposal)).not.toContain("desktopMigrationDefaults");

    const { checkout, requiredOneTime, text } = agreementFor(snapshot);
    const setupTotal = getProposalPricingSnapshotData(assessment).companyBundle?.maintain.setupTotal ?? 0;
    expect(oneTime(checkout)).toBe(2050 + setupTotal);
    // The flat option never stacks, even when the stored selection lists it.
    expect(requiredOneTime).toEqual([]);
    // The select-route carry-through is lossless: the public reconstruction
    // charges exactly what the stored snapshot charges directly.
    const direct = buildProposalCheckoutSummary(snapshot, {
      tier: "maintain",
      hasTwelveMonthAgreement: false,
      selectedCleanupPeriodKeys: [],
      selectedAdditionalOptionIds: [],
    });
    expect(oneTime(checkout)).toBe(direct.additionalOneTimeTotal);
    expect(countOccurrences(text, "QuickBooks Desktop to Online Migration — Full history")).toBe(1);
    expect(text).toContain("QuickBooks Desktop to Online Migration — Full history: $2,050.00 (one-time)");
    expect(text).not.toContain("priced separately");
    // Itemized lines sum to the stored one-time total.
    const requiredTotal = requiredOneTime.reduce((sum, row) => sum + row.price, 0);
    const companyOneTimeTotal = (agreementFor(snapshot).companyFeeLines ?? [])
      .filter((line) => line.cadence === "one-time")
      .reduce((sum, line) => sum + line.amount, 0);
    expect(oneTime(checkout)).toBe(requiredTotal + companyOneTimeTotal + Math.max(0, oneTime(checkout) - requiredTotal - companyOneTimeTotal));
    expect(companyOneTimeTotal).toBe(2050 + setupTotal);
  });
});

describe("spec 05 end to end: fresh start", () => {
  it("ignores history years and the band, with the role-marked flat suppressed", () => {
    const assessment = assessmentFor(
      { choice: "fresh_start", historyYears: 5, payrollHistory: true },
      { additionalOptions: [{ ...roleMarkedFlatOption }] },
    );
    const snapshot = publishedSnapshotFor(assessment);
    // Fresh start ignores the 5 history years and the band; the one extra
    // Desktop file still prices (+250) with the payroll add-on (+150).
    expect((snapshot.pricing as Record<string, unknown>).desktopMigration).toMatchObject({ total: 1040 });
    const { checkout, requiredOneTime, text } = agreementFor(snapshot);
    const setupTotal = getProposalPricingSnapshotData(assessment).companyBundle?.maintain.setupTotal ?? 0;
    expect(oneTime(checkout)).toBe(1040 + setupTotal);
    expect(requiredOneTime).toEqual([]);
    expect(countOccurrences(text, "QuickBooks Desktop to Online Migration — Fresh start")).toBe(1);
    expect(text).toContain("QuickBooks Desktop to Online Migration — Fresh start: $1,040.00 (one-time)");
  });

  it("applies template defaults under per-proposal overrides", () => {
    const fresh = freshAssessment();
    const applied = applyOptionsTemplateSlice(
      assessmentFor({ choice: "fresh_start" }, { companies: [] }),
      {
        optionsCatalogOrder: [],
        additionalOptions: [],
        bonuses: [],
        bonusPackageSelections: {},
        desktopMigrationDefaults: { baseAmount: 700 },
      },
    );
    expect(applied.desktopMigrationDefaults).toEqual({ baseAmount: 700 });
    expect(resolveDesktopMigrationPrice(applied)?.total).toBe(700);
    expect(resolveDesktopMigrationPrice({
      ...applied,
      desktopMigration: { choice: "fresh_start", overrides: { baseAmount: 800 } },
    })?.total).toBe(800);
    expect(fresh.desktopMigration).toBeUndefined();
  });
});

describe("spec 05 legacy: the flat $640 snapshot is unchanged everywhere", () => {
  it("publishes, checks out and signs the flat option byte-identically", () => {
    const assessment = assessmentFor(undefined);
    const pricing = getProposalPricingSnapshotPricing(assessment) as Record<string, unknown>;
    expect("desktopMigration" in pricing).toBe(false);
    const snapshot = publishedSnapshotFor(assessment);
    const publicProposal = toPublicBookkeepingProposal(snapshot);
    expect(publicProposal).not.toHaveProperty("desktopMigration");
    expect(publicProposal.assessment.desktopMigration).toBeUndefined();

    const { checkout, requiredOneTime, text } = agreementFor(snapshot);
    const setupTotal = getProposalPricingSnapshotData(assessment).companyBundle?.maintain.setupTotal ?? 0;
    expect(oneTime(checkout)).toBe(640 + setupTotal);
    expect(requiredOneTime).toEqual([{ name: "QuickBooks Desktop to Online Migration", price: 640 }]);
    expect(text).toContain("QuickBooks Desktop to Online Migration (due today): $640.00");
    expect(text).not.toContain("— Full history");
    expect(text).not.toContain("— Fresh start");
    const requiredTotal = requiredOneTime.reduce((sum, row) => sum + row.price, 0);
    const companyOneTimeTotal = agreementFor(snapshot).companyFeeLines
      .filter((line) => line.cadence === "one-time")
      .reduce((sum, line) => sum + line.amount, 0);
    expect(oneTime(checkout)).toBe(requiredTotal + companyOneTimeTotal + Math.max(0, oneTime(checkout) - requiredTotal - companyOneTimeTotal));
  });

  it("keeps the builder summary quiet with no choice", () => {
    expect(desktopMigrationSummaryText(assessmentFor(undefined))).toBe("Not selected");
    expect(desktopMigrationSuppressedNames(assessmentFor(undefined))).toEqual([]);
    expect(desktopMigrationExtraFileNames(assessmentFor(undefined))).toEqual(["Beta LLC"]);
  });
});

describe("spec 05 client surfaces", () => {
  const block = {
    choice: "Full history",
    lines: [
      { label: "Desktop migration — full history base", amount: 640 },
      { label: "Trial-balance tie-out (included)", amount: 0 },
    ],
    total: 640,
  };

  it("renders the client migration block and hides it when null", () => {
    const markup = renderToStaticMarkup(createElement(DesktopMigrationSummary, { migration: block }));
    expect(markup).toContain("QuickBooks Desktop to Online Migration — Full history");
    expect(markup).toContain("Desktop migration — full history base");
    expect(markup).toContain("Included: balance check — trial balance tie-out to your Desktop file.");
    expect(renderToStaticMarkup(createElement(DesktopMigrationSummary, { migration: null }))).toBe("");
  });

  it("names the suppressed flat option in the builder section", () => {
    const markup = renderToStaticMarkup(
      createElement(DesktopMigrationEditor, {
        selection: { choice: "fresh_start" },
        extraFileNames: ["Beta LLC"],
        suppressedNames: ["QuickBooks Desktop to Online Migration"],
        priced: {
          choice: "fresh_start",
          choiceLabel: "Fresh start",
          band: "0-99",
          extraDesktopFiles: 0,
          lines: [{ id: "base", label: "Desktop migration — fresh start", amount: 640, kind: "base" }],
          total: 640,
        },
        onChange: () => undefined,
      }),
    );
    expect(markup).toContain("replaced by this sized migration");
    expect(markup).toContain("QuickBooks Desktop to Online Migration");
    expect(markup).toContain("Beta LLC (read-only, from Companies)");
  });

  it("switches the company marker to included when sized", () => {
    const priced = getProposalPricingSnapshotData(assessmentFor({ choice: "fresh_start" })).companyBundle?.maintain;
    const sized = renderToStaticMarkup(createElement(CompanyBundleSummary, { priced: priced!, migrationSized: true }));
    expect(sized).toContain("included in Desktop → Online migration");
    const legacyMarkup = renderToStaticMarkup(createElement(CompanyBundleSummary, { priced: priced! }));
    expect(legacyMarkup).toContain("priced separately");
  });
});
