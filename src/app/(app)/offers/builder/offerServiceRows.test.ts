import { describe, expect, it, vi } from "vitest";

// buildOptions is pure, but it sits in a file whose import graph reaches the
// offer server actions (and through them Prisma and next-auth). Stub that leaf
// so the rendering logic can be exercised in a plain node test.
vi.mock("../who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pricingCardServices } from "./pricingCardServices";
import { applyServiceConfiguration, readServiceConfiguration } from "./proposalServiceConfiguration";
import { buildOptions } from "./OfferProposalPreview";
import type { AssessmentState } from "./ProposalCreationWorkspaceDemo";

const FIXTURE_DIR = join(__dirname, "__fixtures__");
const PACKAGE_IDS = ["grow", "improve", "maintain"] as const;

function snapshotFiles() {
  return readdirSync(FIXTURE_DIR).filter((name) => name.endsWith(".snapshot.json")).sort();
}

function assessmentFrom(file: string): AssessmentState {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8"));
  return (raw.assessment ?? raw) as AssessmentState;
}

/** Only the parts a client can actually see, so formatting churn cannot mask a real change. */
function clientVisibleRows(assessment: AssessmentState) {
  const options = buildOptions(assessment);
  return Object.fromEntries(
    PACKAGE_IDS.map((id) => [id, {
      name: options[id].name,
      monthlyPrice: options[id].monthlyPrice,
      recurring: options[id].recurringRows.map((row) => [row.serviceName, row.price, row.note ?? ""]),
      oneTime: options[id].oneTimeRows.map((row) => [row.serviceName, row.price, row.note ?? ""]),
    }]),
  );
}

describe("buildOptions golden fixtures", () => {
  const files = snapshotFiles();

  it("has fixtures covering every real offer, including the signed one", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((name) => name.startsWith("02-accepted"))).toBe(true);
  });

  for (const file of files) {
    it(`renders ${file} unchanged`, () => {
      expect(clientVisibleRows(assessmentFrom(file))).toMatchSnapshot();
    });
  }

  // Tier membership is a CONTIGUOUS RANGE, not a floor. Most services run from
  // some tier upward, but the client-support family is substituted per tier
  // (Standard on Maintain only, Priority on Improve only, Concierge on Grow).
  // A "lowest tier that includes this" model would render all three support
  // levels on the Grow card, so the range is the invariant worth pinning.
  for (const file of files) {
    it(`keeps every tier membership contiguous in ${file}`, () => {
      const rows = clientVisibleRows(assessmentFrom(file));
      const order = ["maintain", "improve", "grow"] as const;
      const names = new Set(order.flatMap((id) => rows[id].recurring.map(([name]) => name)));

      for (const name of names) {
        const membership = order.map((id) =>
          rows[id].recurring.some(([rowName]) => rowName === name),
        );
        const firstIn = membership.indexOf(true);
        const lastIn = membership.lastIndexOf(true);
        const run = membership.slice(firstIn, lastIn + 1);
        expect(
          run.every(Boolean),
          `"${name}" skips a tier: ${JSON.stringify(
            Object.fromEntries(order.map((id, i) => [id, membership[i]])),
          )}`,
        ).toBe(true);
      }
    });
  }

});


describe("included service card placement", () => {
  function configured(cadence: "monthly" | "one-time", placement: "main" | "included") {
    const saved = assessmentFrom("01-draft-draft.snapshot.json");
    const bonus = {
      id: "placement-test", name: "Placement test", description: "Details",
      archived: false, billingCadence: cadence,
      defaultPackageIds: ["maintain", "improve", "grow"] as const,
    };
    const assessment: AssessmentState = {
      ...saved, servicesInitialized: true, additionalOptions: [],
      bonuses: [{ ...bonus, defaultPackageIds: [...bonus.defaultPackageIds] }],
      bonusPackageSelections: {},
    };
    const config = readServiceConfiguration(assessment, { id: bonus.id, bonus: assessment.bonuses[0] });
    const next = applyServiceConfiguration(assessment, bonus.id, { ...config, includedPlacement: placement });
    return { before: buildOptions(assessment), after: buildOptions(next) };
  }

  it.each(["monthly", "one-time"] as const)("moves %s inclusions without changing cadence or prices", (cadence) => {
    for (const placement of ["main", "included"] as const) {
      const { before, after } = configured(cadence, placement);
      for (const tier of PACKAGE_IDS) {
        const card = pricingCardServices(after[tier]);
        const main = [...card.orderedRecurring, ...card.mainOneTime];
        expect(main.some((row) => row.serviceName === "Placement test")).toBe(placement === "main");
        expect(card.displayedBonuses.some((row) => row.serviceName === "Placement test")).toBe(placement === "included");
        expect(after[tier].monthlyPrice).toBe(before[tier].monthlyPrice);
        for (const key of ["recurringRows", "oneTimeRows"] as const) {
          expect(after[tier][key].map((row) => { const copy = { ...row }; delete copy.includedPlacement; return copy; }))
            .toEqual(before[tier][key].map((row) => { const copy = { ...row }; delete copy.includedPlacement; return copy; }));
        }
      }
    }
  });

  it("does not promote explicitly main-list bookkeeping or support as a fallback bonus", () => {
    const row = (id: string, serviceName: string) => ({ id, serviceName, price: 0, includedPlacement: "main" as const });
    const card = pricingCardServices({
      name: "Maintain", oneTimeRows: [], recurringRows: [
        row("maintain-bonus-monthly-bookkeeping", "Monthly Bookkeeping"),
        row("support", "Standard Client Support"),
      ],
    });
    expect(card.bkRow).toBeDefined();
    expect(card.supportRow).toBeDefined();
    expect(card.displayedBonuses).toEqual([]);
  });

  it("keeps explicitly placed support and bookkeeping out of the main section", () => {
    const rows = ["Monthly Bookkeeping", "Standard Client Support"].map((serviceName) => ({
      id: serviceName, serviceName, price: 0, includedPlacement: "included" as const,
    }));
    const card = pricingCardServices({ name: "Maintain", oneTimeRows: [], recurringRows: rows });
    expect(card.bkRow).toBeUndefined();
    expect(card.supportRow).toBeUndefined();
    expect(card.orderedRecurring).toEqual([]);
    expect(card.displayedBonuses).toEqual(rows);
  });

  it("shows an inheritance statement when all banner services are inherited and no automatic highlight remains", () => {
    const { after } = configured("monthly", "included");
    const card = pricingCardServices(after.improve, after.maintain);
    expect(card.hasInheritedBonuses).toBe(true);
    expect(card.displayedBonuses).toEqual([]);
    expect(card.orderedRecurring).toEqual([]);
  });

  it("only inherits services from the same section of the lower tier", () => {
    const lower = { name: "Maintain", oneTimeRows: [], recurringRows: [
      { id: "lower-report", serviceName: "Reports", price: 0, includedPlacement: "main" as "main" | "included" },
    ] };
    const upper = { name: "Improve", oneTimeRows: [], recurringRows: [
      { id: "upper-report", serviceName: "Reports", price: 0, includedPlacement: "included" as "main" | "included" },
    ] };
    const card = pricingCardServices(upper, lower);
    expect(card.recurringLeadInName).toBeNull();
    expect(card.displayedBonuses.map((row) => row.serviceName)).toEqual(["Reports"]);
  });
});
