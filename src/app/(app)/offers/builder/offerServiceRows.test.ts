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


describe("consolidated included services", () => {
  function configured(cadence: "monthly" | "one-time", placement: "main" | "included") {
    const saved = assessmentFrom("01-draft-draft.snapshot.json");
    const bonus = {
      id: "placement-test", name: "Placement test", description: "Details",
      archived: false, billingCadence: cadence, includedPlacement: placement,
      defaultPackageIds: ["maintain", "improve", "grow"] as const,
    };
    const assessment: AssessmentState = {
      ...saved, servicesInitialized: true, additionalOptions: [],
      bonuses: [{ ...bonus, defaultPackageIds: [...bonus.defaultPackageIds] }],
      bonusPackageSelections: {},
    };
    const config = readServiceConfiguration(assessment, { id: bonus.id, bonus: assessment.bonuses[0] });
    const next = applyServiceConfiguration(assessment, bonus.id, config);
    return { before: buildOptions(assessment), after: buildOptions(next) };
  }

  it.each(["monthly", "one-time"] as const)("lists %s inclusions regardless of saved placement without changing billing", (cadence) => {
    for (const placement of ["main", "included"] as const) {
      const { before, after } = configured(cadence, placement);
      for (const tier of PACKAGE_IDS) {
        const card = pricingCardServices(after[tier]);
        expect(card.includedRows.map((row) => row.serviceName)).toEqual(["Placement test"]);
        expect(after[tier]).toEqual(before[tier]);
      }
    }
  });

  it("includes bookkeeping and support saved with main-list placement", () => {
    const row = (id: string, serviceName: string) => ({ id, serviceName, price: 0, includedPlacement: "main" as const });
    const card = pricingCardServices({
      name: "Maintain", oneTimeRows: [], recurringRows: [
        row("maintain-bonus-monthly-bookkeeping", "Monthly Bookkeeping"),
        row("support", "Standard Client Support"),
      ],
    });
    expect(card.includedRows.map((row) => row.serviceName)).toEqual(["Monthly Bookkeeping", "Standard Client Support"]);
  });

  it("keeps explicitly placed support and bookkeeping out of the main section", () => {
    const rows = ["Monthly Bookkeeping", "Standard Client Support"].map((serviceName) => ({
      id: serviceName, serviceName, price: 0, includedPlacement: "included" as const,
    }));
    const card = pricingCardServices({ name: "Maintain", oneTimeRows: [], recurringRows: rows });
    expect(card.includedRows).toEqual(rows);
  });

  it("retains the lower-tier summary without repeating services when there are no additions", () => {
    const { after } = configured("monthly", "included");
    const card = pricingCardServices(after.improve, after.maintain);
    expect(card.lowerTierName).toBe(after.maintain.name);
    expect(card.includedRows).toEqual([]);
  });

  it("identifies inherited services despite different saved placements", () => {
    const lower = { name: "Maintain", oneTimeRows: [], recurringRows: [
      { id: "maintain-bonus-report", serviceName: "Reports", price: 0, includedPlacement: "main" as "main" | "included" },
    ] };
    const upper = { name: "Improve", oneTimeRows: [], recurringRows: [
      { id: "improve-bonus-report", serviceName: "Reports", price: 0, includedPlacement: "included" as "main" | "included" },
    ] };
    const card = pricingCardServices(upper, lower);
    expect(card.lowerTierName).toBe("Maintain");
    expect(card.includedRows).toEqual([]);
  });

  it.each(["Improve", "Grow"])("shows the lower tier and only recurring additions for %s despite a support upgrade", (name) => {
    const row = (serviceName: string) => ({ id: serviceName, serviceName, price: 0 });
    const lowerName = name === "Improve" ? "Maintain" : "Improve";
    const shared = row("Monthly reports");
    const addition = row("Cash flow forecast");
    const card = pricingCardServices({
      name, oneTimeRows: [],
      recurringRows: [shared, addition, row("Priority Client Support")],
    }, {
      name: lowerName, oneTimeRows: [],
      recurringRows: [shared, row("Standard Client Support")],
    });
    expect(card.lowerTierName).toBe(lowerName);
    expect(card.includedRows).toEqual([addition, row("Priority Client Support")]);
  });

  it("lists included one-time work while keeping paid setup, onboarding and cleanup out", () => {
    const row = (id: string, serviceName: string, price = 0) => ({ id, serviceName, price });
    const card = pricingCardServices({
      name: "Maintain", recurringRows: [], oneTimeRows: [
        row("setup", "Included setup"), row("paid", "Paid setup", 100),
        row("onboarding", "Onboarding"),
        { ...row("cleanup", "Catch-up"), cleanupPeriodKey: "2026" },
      ],
    });
    expect(card.includedRows).toEqual([row("setup", "Included setup")]);
  });
});
