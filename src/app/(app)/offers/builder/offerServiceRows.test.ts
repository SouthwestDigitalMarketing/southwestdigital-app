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
