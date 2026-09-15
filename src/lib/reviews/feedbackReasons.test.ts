import { describe, expect, it } from "vitest";
import { formatPrivateFeedbackText, PRIVATE_FEEDBACK_REASONS } from "./feedbackReasons";

describe("PRIVATE_FEEDBACK_REASONS", () => {
  it("includes Something else as the last option", () => {
    expect(PRIVATE_FEEDBACK_REASONS.at(-1)).toMatchObject({ id: "other", label: "Something else" });
  });
});

describe("formatPrivateFeedbackText", () => {
  it("stores a single named reason without extra text", () => {
    expect(formatPrivateFeedbackText(["pricing"], "  ")).toBe("Pricing");
  });

  it("appends extra detail to a named reason", () => {
    expect(formatPrivateFeedbackText(["communication"], " slow replies ")).toBe(
      "Communication: slow replies",
    );
  });

  it("joins multiple selected reasons", () => {
    expect(formatPrivateFeedbackText(["communication", "pricing"], "")).toBe(
      "Communication, Pricing",
    );
  });

  it("joins multiple reasons with extra detail", () => {
    expect(formatPrivateFeedbackText(["communication", "other"], " parking ")).toBe(
      "Communication, Something else: parking",
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
