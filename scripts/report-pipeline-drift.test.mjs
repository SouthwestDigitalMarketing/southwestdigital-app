import { describe, expect, it } from "vitest";

import { findDriftSeats, formatSeat } from "./report-pipeline-drift.mjs";

function seat(overrides = {}) {
  return {
    id: "item-1",
    pipelineId: "pipe-1",
    pipelineKey: "pipe-prospects",
    stageKey: "talking",
    brandId: "brand-1",
    leadId: "lead-1",
    leadName: "Ann Client",
    contactNames: ["Ann Client"],
    supportingPipelineIds: ["pipe-1"],
    ...overrides,
  };
}

describe("findDriftSeats", () => {
  it("keeps seats whose held tags still map to the pipeline", () => {
    expect(findDriftSeats([seat()])).toEqual([]);
  });

  it("flags a seat whose supporting tag was removed (no mapping left)", () => {
    const drift = findDriftSeats([seat({ supportingPipelineIds: [] })]);
    expect(drift).toHaveLength(1);
    expect(drift[0].id).toBe("item-1");
  });

  it("flags a seat whose lead has no linked contact", () => {
    const drift = findDriftSeats([
      seat({ contactNames: [], supportingPipelineIds: [] }),
    ]);
    expect(drift).toHaveLength(1);
  });

  it("flags a seat supported only toward a different pipeline", () => {
    const drift = findDriftSeats([
      seat({ pipelineId: "pipe-1", supportingPipelineIds: ["pipe-2"] }),
    ]);
    expect(drift).toHaveLength(1);
  });

  it("separates drift from supported seats in one pass", () => {
    const result = findDriftSeats([
      seat({ id: "ok", supportingPipelineIds: ["pipe-1"] }),
      seat({ id: "drifted", supportingPipelineIds: [] }),
    ]);
    expect(result.map((s) => s.id)).toEqual(["drifted"]);
  });
});

describe("formatSeat", () => {
  it("names the pipeline, stage, lead, and contact", () => {
    expect(formatSeat(seat())).toContain("pipe-prospects/talking");
    expect(formatSeat(seat())).toContain("Ann Client");
  });

  it("says when no contact is linked", () => {
    expect(formatSeat(seat({ contactNames: [] }))).toContain("no linked contact");
  });
});
