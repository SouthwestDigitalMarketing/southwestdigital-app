import { describe, expect, it } from "vitest";
import { formatPrivateFeedbackText, PRIVATE_FEEDBACK_REASONS } from "./feedbackReasons";

describe("PRIVATE_FEEDBACK_REASONS", () => {
  it("includes Something else as the last option", () => {
    expect(PRIVATE_FEEDBACK_REASONS.at(-1)).toMatchObject({ id: "other", label: "Something else" });
  });
});

describe("formatPrivateFeedbackText", () => {
  it("stores a named reason without extra text", () => {
    expect(formatPrivateFeedbackText("pricing", "  ")).toBe("Pricing");
  });

  it("appends extra detail to a named reason", () => {
    expect(formatPrivateFeedbackText("communication", " slow replies ")).toBe(
      "Communication: slow replies",
    );
  });

  it("stores Something else as the typed text", () => {
    expect(formatPrivateFeedbackText("other", "  parking  ")).toBe("parking");
    expect(formatPrivateFeedbackText("other", "")).toBe("Something else");
  });
});
