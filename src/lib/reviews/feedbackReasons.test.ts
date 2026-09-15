import { describe, expect, it } from "vitest";
import { formatPrivateFeedbackText, PRIVATE_FEEDBACK_REASONS } from "./feedbackReasons";

describe("PRIVATE_FEEDBACK_REASONS", () => {
  it("uses the exact problem labels in registry order", () => {
    expect(PRIVATE_FEEDBACK_REASONS).toEqual([
      { id: "communication", label: "Poor communication" },
      { id: "turnaround", label: "Slow turnaround time" },
      { id: "pricing", label: "Pricing concerns" },
      { id: "quality", label: "Quality of work concerns" },
      { id: "other", label: "Something else" },
    ]);
  });
});

describe("formatPrivateFeedbackText", () => {
  it("stores a single named reason without extra text", () => {
    expect(formatPrivateFeedbackText(["pricing"], "  ")).toBe("Pricing concerns");
  });

  it("appends extra detail to a named reason", () => {
    expect(formatPrivateFeedbackText(["communication"], " slow replies ")).toBe(
      "Poor communication: slow replies",
    );
  });

  it("joins multiple selected reasons", () => {
    expect(formatPrivateFeedbackText(["communication", "pricing"], "")).toBe(
      "Poor communication, Pricing concerns",
    );
  });

  it("joins multiple reasons with extra detail", () => {
    expect(formatPrivateFeedbackText(["communication", "other"], " parking ")).toBe(
      "Poor communication, Something else: parking",
    );
  });

  it("stores Something else as its label without detail", () => {
    expect(formatPrivateFeedbackText(["other"], "")).toBe("Something else");
  });

  it("returns null with no reasons selected and no detail", () => {
    expect(formatPrivateFeedbackText([], "  ")).toBeNull();
  });

  it("returns the typed detail with no reasons selected", () => {
    expect(formatPrivateFeedbackText([], " parking ")).toBe("parking");
  });
});
