import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { proposalAlertText } = await import("./staffAlert");

describe("proposalAlertText", () => {
  it("names the client, company and amount", () => {
    expect(proposalAlertText({ kind: "paid", clientName: "Daniel Ruiz Jr", company: "Rodan Properties LLC", amount: 780, currency: "usd", detail: "via stripe" }))
      .toBe("SWapp: Deposit PAID\nDaniel Ruiz Jr, Rodan Properties LLC\n$780.00\nvia stripe");
  });

  it("marks test proposals and drops empty parts", () => {
    expect(proposalAlertText({ kind: "signed", clientName: "Tom", company: "", isTest: true }))
      .toBe("[TEST] SWapp: Proposal signed\nTom");
  });
});
