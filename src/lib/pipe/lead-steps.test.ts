import { describe, expect, it } from "vitest";
import {
  LEAD_STEP_LABEL,
  LEAD_STEP_STAGE,
  LEAD_STEPS,
  pipeLeadBoardColumnId,
} from "./lead-steps";

describe("pipe Leads board columns", () => {
  it("defines the six named columns with the existing pipe stage mapping", () => {
    expect(LEAD_STEPS.map((step) => [step, LEAD_STEP_LABEL[step], LEAD_STEP_STAGE[step]])).toEqual([
      ["reach", "Reach decision maker", "lead"],
      ["qb", "Get QB access", "talking"],
      ["book", "Book review call", "talking"],
      ["call", "Conduct review call", "talking"],
      ["quote", "Send Quote & Contract", "proposed"],
      ["nurture", "Nurture", "proposed"],
    ]);
  });

  it("groups matching saved steps and gives unset or mismatched active stages a clear fallback", () => {
    expect(pipeLeadBoardColumnId("stage-talking", "talking", "book")).toBe("lead-step-book");
    expect(pipeLeadBoardColumnId("stage-lead", "lead", null)).toBe("lead-step-reach");
    expect(pipeLeadBoardColumnId("stage-talking", "talking", "reach")).toBe("lead-step-qb");
    expect(pipeLeadBoardColumnId("stage-won", "won", null)).toBe("stage-won");
  });
});
