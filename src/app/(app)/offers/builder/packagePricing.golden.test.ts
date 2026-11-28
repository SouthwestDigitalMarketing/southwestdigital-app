import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import {
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotData,
  getProposalPricingSnapshotItems,
  mergeStoredAssessment,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import { effectiveAssessment } from "./effectiveAssessment";
import {
  buildPackagePricing,
  derivedPricingComplexityLevel,
  getMonthlyRateBreakdown,
  PACKAGE_PRICING,
} from "@/lib/quotes/packagePricing";

/**
 * Spec 02 golden test (freeze rule): legacy proposals (no `companies`) must
 * price, score and render EXACTLY as today. Every expectation below is a
 * literal captured from current code (2026-11-27) and hand-checked, NOT
 * generated from the implementation at test time — so any pricing drift
 * fails loudly instead of being re-baselined.
 *
 * NOTE: the builder's default `historicalCleanupPeriods` depend on the
 * current month, so synthetic cases use `historicalCleanupPeriods: []`
 * (onboarding then = $500). Fixture snapshots pin their own periods.
 */
function freshAssessment(): AssessmentState {
  let state: AssessmentState;
  function Capture() {
    state = useProposalAssessmentDemoState({ persist: false }).assessment;
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return state!;
}

function noHistory(assessment: AssessmentState): AssessmentState {
  return { ...assessment, historicalCleanupPeriods: [] };
}

interface ExpectedPackage {
  complexityLevel: string;
  monthly: number;
  catchUpBase: number;
  assessmentOneTimeAdjustments: number;
  totalOneTimeBeforeManual: number;
  totalOneTime: number;
}

function pkg(
  complexityLevel: string,
  monthly: number,
  catchUpBase: number,
  assessmentOneTimeAdjustments: number,
  totalOneTimeBeforeManual: number,
  totalOneTime: number,
): ExpectedPackage {
  return {
    complexityLevel,
    monthly,
    catchUpBase,
    assessmentOneTimeAdjustments,
    totalOneTimeBeforeManual,
    totalOneTime,
  };
}

function checkGolden(
  assessment: AssessmentState,
  expected: {
    cleanupMonths: number;
    hasCatchUpPricing: boolean;
    recommendation: {
      servicePath: string;
      packageId: string;
      confidence: string;
      rationale: string[];
      watchouts: string[];
    };
    grow: ExpectedPackage;
    improve: ExpectedPackage;
    maintain: ExpectedPackage;
    cleanupCard: unknown;
  },
) {
  const data = getProposalPricingSnapshotData(assessment);
  expect(data.cleanupMonths).toBe(expected.cleanupMonths);
  expect(data.hasCatchUpPricing).toBe(expected.hasCatchUpPricing);
  expect(data.recommendation).toEqual(expected.recommendation);
  for (const id of ["grow", "improve", "maintain"] as const) {
    expect({ ...data.packagePricing[id] }).toEqual({
      packageId: id,
      ...expected[id],
    });
  }
  expect(getProposalPricingSnapshotCleanupCard(assessment)).toEqual(expected.cleanupCard);
}

describe("spec 02 golden: legacy builder package pricing", () => {
  it("prices an empty assessment at base with standard complexity", () => {
    checkGolden(noHistory(freshAssessment()), {
      cleanupMonths: 0,
      hasCatchUpPricing: false,
      recommendation: {
        servicePath: "Monthly bookkeeping only",
        packageId: "maintain",
        confidence: "Simpler monthly fit",
        rationale: ["The current facts point to a standard monthly bookkeeping recommendation."],
        watchouts: [],
      },
      grow: pkg("standard", 375, 0, 0, 0, 0),
      improve: pkg("standard", 250, 0, 0, 0, 0),
      maintain: pkg("standard", 250, 0, 0, 0, 0),
      cleanupCard: {
        amountLabel: "$500",
        detailRows: ["Onboarding (due at signing): $500"],
      },
    });
  });

  it("prices one legacy entity (maintain 350, grow = ceil5(maintain x 1.5))", () => {
    checkGolden(noHistory({ ...freshAssessment(), numberOfEntities: 1 }), {
      cleanupMonths: 0,
      hasCatchUpPricing: false,
      recommendation: {
        servicePath: "Monthly bookkeeping only",
        packageId: "maintain",
        confidence: "Simpler monthly fit",
        rationale: ["The current facts point to a standard monthly bookkeeping recommendation."],
        watchouts: [],
      },
      grow: pkg("standard", 525, 0, 75, 75, 75),
      improve: pkg("standard", 375, 0, 75, 75, 75),
      maintain: pkg("standard", 350, 0, 50, 50, 50),
      cleanupCard: {
        amountLabel: "$550",
        detailRows: ["$50 required adjustments", "Onboarding (due at signing): $500"],
      },
    });
  });

  it("prices three legacy entities with the entity rationale line", () => {
    checkGolden(noHistory({ ...freshAssessment(), numberOfEntities: 3 }), {
      cleanupMonths: 0,
      hasCatchUpPricing: false,
      recommendation: {
        servicePath: "Monthly bookkeeping only",
        packageId: "maintain",
        confidence: "Simpler monthly fit",
        rationale: ["3 entities increase coordination and reporting complexity."],
        watchouts: [],
      },
      grow: pkg("standard", 825, 0, 225, 225, 225),
      improve: pkg("standard", 625, 0, 225, 225, 225),
      maintain: pkg("standard", 550, 0, 150, 150, 150),
      cleanupCard: {
        amountLabel: "$650",
        detailRows: ["$150 required adjustments", "Onboarding (due at signing): $500"],
      },
    });
  });

  it("prices five properties on real-estate-only books", () => {
    checkGolden(
      noHistory({ ...freshAssessment(), numberOfProperties: 5, bookSetType: "real-estate-only" }),
      {
        cleanupMonths: 0,
        hasCatchUpPricing: false,
        recommendation: {
          servicePath: "Monthly bookkeeping only",
          packageId: "maintain",
          confidence: "Simpler monthly fit",
          rationale: [
            "The books appear to be primarily real-estate books, so the REI package path is a fit.",
            "5 properties point toward a portfolio-style bookkeeping scope.",
          ],
          watchouts: [],
        },
        grow: pkg("standard", 750, 0, 150, 150, 150),
        improve: pkg("standard", 500, 0, 150, 150, 150),
        maintain: pkg("standard", 500, 0, 100, 100, 100),
        cleanupCard: {
          amountLabel: "$600",
          detailRows: ["$100 required adjustments", "Onboarding (due at signing): $500"],
        },
      },
    );
  });

  it("prices payroll headcount with the payroll watchout", () => {
    checkGolden(
      noHistory({ ...freshAssessment(), runsPayroll: true, employeesCount: 4, contractorsCount: 2 }),
      {
        cleanupMonths: 0,
        hasCatchUpPricing: false,
        recommendation: {
          servicePath: "Monthly bookkeeping only",
          packageId: "maintain",
          confidence: "Simpler monthly fit",
          rationale: ["The current facts point to a standard monthly bookkeeping recommendation."],
          watchouts: [
            "Payroll and contractor activity should be confirmed before final pricing is approved.",
          ],
        },
        grow: pkg("standard", 690, 0, 0, 0, 0),
        improve: pkg("standard", 520, 0, 0, 0, 0),
        maintain: pkg("standard", 460, 0, 0, 0, 0),
        cleanupCard: {
          amountLabel: "$500",
          detailRows: ["Onboarding (due at signing): $500"],
        },
      },
    );
  });

  it("prices a manual 100-499 transaction band", () => {
    checkGolden(noHistory({ ...freshAssessment(), transactionBand: "100-499" }), {
      cleanupMonths: 0,
      hasCatchUpPricing: false,
      recommendation: {
        servicePath: "Monthly bookkeeping only",
        packageId: "maintain",
        confidence: "Simpler monthly fit",
        rationale: ["The current facts point to a standard monthly bookkeeping recommendation."],
        watchouts: [],
      },
      grow: pkg("standard", 480, 0, 0, 0, 0),
      improve: pkg("standard", 340, 0, 0, 0, 0),
      maintain: pkg("standard", 320, 0, 0, 0, 0),
      cleanupCard: {
        amountLabel: "$500",
        detailRows: ["Onboarding (due at signing): $500"],
      },
    });
  });

  it("prices a heavy 1000+ assessment as complex with an improve recommendation", () => {
    checkGolden(
      noHistory({
        ...freshAssessment(),
        transactionBand: "1000+",
        numberOfEntities: 2,
        numberOfProperties: 12,
      }),
      {
        cleanupMonths: 0,
        hasCatchUpPricing: false,
        recommendation: {
          servicePath: "Monthly bookkeeping only",
          packageId: "improve",
          confidence: "Default recommendation",
          rationale: [
            "The transaction profile (1000+) suggests a heavier monthly workload.",
            "2 entities increase coordination and reporting complexity.",
            "12 properties point toward a portfolio-style bookkeeping scope.",
          ],
          watchouts: [],
        },
        grow: pkg("complex", 2220, 0, 510, 510, 510),
        improve: pkg("complex", 1660, 0, 510, 510, 510),
        maintain: pkg("complex", 1480, 0, 340, 340, 340),
        cleanupCard: {
          amountLabel: "$840",
          detailRows: ["$340 required adjustments", "Onboarding (due at signing): $500"],
        },
      },
    );
  });

  it("derives the 500-999 band from account inventory (3 x 200/mo)", () => {
    checkGolden(
      noHistory({
        ...freshAssessment(),
        accounts: [
          { id: "c1", kind: "checking", label: "c1", monthlyTransactions: 200, status: "open", basis: "measured" },
          { id: "c2", kind: "checking", label: "c2", monthlyTransactions: 200, status: "open", basis: "measured" },
          { id: "c3", kind: "checking", label: "c3", monthlyTransactions: 200, status: "open", basis: "measured" },
        ],
      }),
      {
        cleanupMonths: 0,
        hasCatchUpPricing: false,
        recommendation: {
          servicePath: "Monthly bookkeeping only",
          packageId: "maintain",
          confidence: "Simpler monthly fit",
          rationale: [
            "The transaction profile (500-999) suggests a heavier monthly workload.",
            "3 balance-sheet accounts suggest a heavier reconciliation process each month.",
          ],
          watchouts: [],
        },
        grow: pkg("standard", 600, 0, 0, 0, 0),
        improve: pkg("standard", 450, 0, 0, 0, 0),
        maintain: pkg("standard", 400, 0, 0, 0, 0),
        cleanupCard: {
          amountLabel: "$500",
          detailRows: ["Onboarding (due at signing): $500"],
        },
      },
    );
  });

  it("prices a 6-month cleanup with backlog, bought/sold property and discovery onboarding", () => {
    checkGolden(
      {
        ...freshAssessment(),
        booksOverTwoMonthsBehind: true,
        cleanupStartMonth: "2026-01",
        cleanupEndMonth: "2026-06",
        numberOfEntities: 2,
        numberOfProperties: 3,
        historicalCleanupPeriods: [
          { id: "p", year: 2026, startMonth: 1, endMonth: 6, platform: "qbo", purchasedOrSoldPropertiesCount: 1 },
        ],
      },
      {
        cleanupMonths: 6,
        hasCatchUpPricing: true,
        recommendation: {
          servicePath: "Monthly bookkeeping plus historical catch-up",
          packageId: "maintain",
          confidence: "Simpler monthly fit",
          rationale: [
            "2 entities increase coordination and reporting complexity.",
            "3 properties point toward a portfolio-style bookkeeping scope.",
            "A 6-month cleanup window means catch-up work should be framed separately from the monthly tier.",
          ],
          watchouts: [],
        },
        grow: pkg("standard", 900, 5400, 540, 5940, 5940),
        improve: pkg("standard", 650, 3900, 440, 4340, 4340),
        maintain: pkg("standard", 600, 3600, 360, 3960, 3960),
        cleanupCard: {
          amountLabel: "$4,580",
          detailRows: [
            "Cleanup estimate (not charged at signing): $600 x 6 months = $3,600",
            "$360 required adjustments",
            "Onboarding + Discovery (due at signing): $620",
          ],
        },
      },
    );
  });

  it("prices mixed books with complex operations as complex / needs-review", () => {
    checkGolden(
      noHistory({
        ...freshAssessment(),
        bookSetType: "mixed-books",
        realEstateOperations: ["short-term-rentals", "flips"],
        transactionBand: "500-999",
      }),
      {
        cleanupMonths: 0,
        hasCatchUpPricing: false,
        recommendation: {
          servicePath: "Monthly bookkeeping only",
          packageId: "improve",
          confidence: "Needs human review",
          rationale: [
            "The books are mixed, which usually pushes us toward a more guided package and a custom scope review.",
            "The transaction profile (500-999) suggests a heavier monthly workload.",
            "The mix of real-estate operations adds complexity beyond a basic monthly close.",
          ],
          watchouts: [
            "Mixed books should be reviewed carefully before assuming a standard REI package fit.",
          ],
        },
        grow: pkg("complex", 1200, 0, 0, 0, 0),
        improve: pkg("complex", 975, 0, 0, 0, 0),
        maintain: pkg("complex", 800, 0, 0, 0, 0),
        cleanupCard: {
          amountLabel: "$500",
          detailRows: ["Onboarding (due at signing): $500"],
        },
      },
    );
  });

  it("labels items per tier for a heavy assessment and dashes an empty one", () => {
    const heavy = noHistory({
      ...freshAssessment(),
      transactionBand: "1000+",
      numberOfEntities: 2,
      numberOfProperties: 12,
    });
    expect(getProposalPricingSnapshotItems(heavy).map((item) => item.monthlyLabel)).toEqual([
      "$2,220/mo",
      "$1,660/mo",
      "$1,480/mo",
    ]);
    // Even the empty assessment has monthly inputs (paymentPlatforms defaults to ["unknown"]).
    expect(getProposalPricingSnapshotItems(noHistory(freshAssessment())).map((item) => item.monthlyLabel)).toEqual([
      "$375/mo",
      "$250/mo",
      "$250/mo",
    ]);
  });

  it.each([
    ["01-draft-draft.snapshot.json", "improve", 825, 650, 550, "$350"],
    ["01-draft-published.snapshot.json", "improve", 825, 650, 550, "$350"],
    ["02-accepted-draft.snapshot.json", "improve", 1005, 790, 670, "$350"],
    ["02-accepted-published.snapshot.json", "improve", 1005, 790, 670, "$350"],
    ["03-archived-draft.snapshot.json", "improve", 1005, 790, 670, "$350"],
    ["03-archived-published.snapshot.json", "improve", 1005, 790, 670, "$350"],
  ])("reprices fixture %s exactly (recommend %s, grow/improve/maintain %s/%s/%s, card %s)", (
    file,
    recommended,
    grow,
    improve,
    maintain,
    card,
  ) => {
    const fresh = freshAssessment();
    const raw = JSON.parse(readFileSync(join(__dirname, "__fixtures__", file), "utf8"));
    const assessment = mergeStoredAssessment(JSON.stringify(raw.assessment), fresh);
    const data = getProposalPricingSnapshotData(assessment);
    expect(data.recommendation.packageId).toBe(recommended);
    expect(data.packagePricing.grow.monthly).toBe(grow);
    expect(data.packagePricing.improve.monthly).toBe(improve);
    expect(data.packagePricing.maintain.monthly).toBe(maintain);
    expect(getProposalPricingSnapshotCleanupCard(assessment)?.amountLabel).toBe(card);
  });

  it("reprices the test-proposal fixture at $1 one-time / $0 monthly", () => {
    const fresh = freshAssessment();
    const raw = JSON.parse(
      readFileSync(join(__dirname, "__fixtures__", "04-draft-draft.snapshot.json"), "utf8"),
    );
    const assessment = mergeStoredAssessment(JSON.stringify(raw.assessment), fresh);
    const data = getProposalPricingSnapshotData(assessment);
    for (const id of ["grow", "improve", "maintain"] as const) {
      expect(data.packagePricing[id].monthly).toBe(0);
      expect(data.packagePricing[id].totalOneTime).toBe(1);
    }
    expect(getProposalPricingSnapshotCleanupCard(assessment)).toEqual({ amountLabel: "$1" });
  });

describe("spec 02 golden: extracted pure module parity", () => {
  function effective(a: AssessmentState) {
    return effectiveAssessment(a);
  }

  it("buildPackagePricing on the maintain spec matches the snapshot maintain tier", () => {
    const fresh = freshAssessment();
    const cases: Array<{ months: number; assessment: AssessmentState }> = [
      { months: 0, assessment: { ...fresh, numberOfEntities: 1 } },
      { months: 0, assessment: { ...fresh, transactionBand: "1000+", numberOfEntities: 2, numberOfProperties: 12 } },
      {
        months: 6,
        assessment: {
          ...fresh,
          booksOverTwoMonthsBehind: true,
          cleanupStartMonth: "2026-01",
          cleanupEndMonth: "2026-06",
          numberOfEntities: 2,
          numberOfProperties: 3,
          historicalCleanupPeriods: [
            { id: "p", year: 2026, startMonth: 1, endMonth: 6, platform: "qbo", purchasedOrSoldPropertiesCount: 1 },
          ],
        },
      },
    ];
    for (const { months, assessment } of cases) {
      expect(buildPackagePricing(PACKAGE_PRICING.maintain, effective(assessment), months, 0)).toEqual(
        getProposalPricingSnapshotData(assessment).packagePricing.maintain,
      );
    }
  });

  it("derives standard vs complex levels exactly as the snapshot tiers report", () => {
    const fresh = freshAssessment();
    expect(derivedPricingComplexityLevel(effective(fresh))).toBe("standard");
    expect(
      derivedPricingComplexityLevel(effective({ ...fresh, numberOfEntities: 1 })),
    ).toBe("standard");
    expect(
      derivedPricingComplexityLevel(
        effective({ ...fresh, transactionBand: "1000+", numberOfEntities: 2, numberOfProperties: 12 }),
      ),
    ).toBe("complex");
  });

  it("emits the maintain breakdown rows for one legacy entity", () => {
    const fresh = freshAssessment();
    const assessment = effective({ ...fresh, numberOfEntities: 1 });
    expect(
      getMonthlyRateBreakdown(PACKAGE_PRICING.maintain, assessment, "standard"),
    ).toEqual({
      baseItems: [
        { label: "Base monthly package", amount: 250 },
        { label: "1 additional entities", amount: 100 },
      ],
      adjustmentItems: [],
    });
  });

  it("emits the maintain breakdown rows for the heavy 1000+ assessment", () => {
    const fresh = freshAssessment();
    const assessment = effective({
      ...fresh,
      transactionBand: "1000+",
      numberOfEntities: 2,
      numberOfProperties: 12,
    });
    expect(
      getMonthlyRateBreakdown(PACKAGE_PRICING.maintain, assessment, "complex"),
    ).toEqual({
      baseItems: [
        { label: "Base monthly package", amount: 250 },
        { label: "12 properties", amount: 600 },
        { label: "2 additional entities", amount: 200 },
        { label: "Complexity (complex)", amount: 150 },
        { label: "Transaction volume", amount: 280 },
      ],
      adjustmentItems: [],
    });
  });

  it("emits the maintain breakdown rows for the cleanup assessment", () => {
    const fresh = freshAssessment();
    const assessment = effective({
      ...fresh,
      booksOverTwoMonthsBehind: true,
      cleanupStartMonth: "2026-01",
      cleanupEndMonth: "2026-06",
      numberOfEntities: 2,
      numberOfProperties: 3,
      historicalCleanupPeriods: [
        { id: "p", year: 2026, startMonth: 1, endMonth: 6, platform: "qbo", purchasedOrSoldPropertiesCount: 1 },
      ],
    });
    expect(
      getMonthlyRateBreakdown(PACKAGE_PRICING.maintain, assessment, "standard"),
    ).toEqual({
      baseItems: [
        { label: "Base monthly package", amount: 250 },
        { label: "3 properties", amount: 150 },
        { label: "2 additional entities", amount: 200 },
      ],
      adjustmentItems: [],
    });
  });
});

  it("keeps every fixture file present in the manifest", () => {
    const dir = join(__dirname, "__fixtures__");
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    expect([...manifest].sort()).toEqual(
      readdirSync(dir).filter((f) => f.endsWith(".snapshot.json")).sort(),
    );
  });
});
