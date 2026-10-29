import { describe, expect, it } from "vitest";
import { MAX_EVENTS_PER_REQUEST, sanitizeSessionId, sanitizeViewEvents } from "./viewEvents";

describe("sanitizeViewEvents", () => {
  it("drops unknown types and non-objects", () => {
    expect(sanitizeViewEvents([{ type: "hack" }, null, "x", { type: "view" }])).toEqual([
      { type: "view", step: null, packageId: null, position: null, value: null },
    ]);
  });

  it("clamps numbers and rejects odd package ids", () => {
    const [event] = sanitizeViewEvents([
      { type: "package_seen", step: 99, packageId: "<script>", position: -4, value: 1e12 },
    ]);
    expect(event).toEqual({ type: "package_seen", step: 10, packageId: null, position: 0, value: 86_400_000 });
  });

  it("caps the batch size and tolerates non-arrays", () => {
    const many = Array.from({ length: 100 }, () => ({ type: "step", step: 1 }));
    expect(sanitizeViewEvents(many)).toHaveLength(MAX_EVENTS_PER_REQUEST);
    expect(sanitizeViewEvents("nope")).toEqual([]);
  });
});

describe("sanitizeSessionId", () => {
  it("accepts short word-like ids only", () => {
    expect(sanitizeSessionId("abc-123_X")).toBe("abc-123_X");
    expect(sanitizeSessionId("a b")).toBeNull();
    expect(sanitizeSessionId("x".repeat(65))).toBeNull();
    expect(sanitizeSessionId(5)).toBeNull();
  });
});
