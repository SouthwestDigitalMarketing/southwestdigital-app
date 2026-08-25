import { describe, expect, it } from "vitest";
import { codeFromName, normalizeClientCode } from "./code";

describe("normalizeClientCode", () => {
  it("uppercases and strips to a short code", () => {
    expect(normalizeClientCode(" acme llc ")).toBe("ACME-LLC");
    expect(normalizeClientCode("Robertson Residential")).toBe("ROBERTSON-RESIDENTIAL");
  });
});

describe("codeFromName", () => {
  it("falls back when the name has no usable characters", () => {
    expect(codeFromName("!!!")).toBe("CLIENT");
  });
});
