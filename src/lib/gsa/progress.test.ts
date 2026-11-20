import { describe, expect, it } from "vitest";
import { currentGsaStep, formatWaiting, gsaFolderCandidates, hoursSincePaid, nextGsaAction, readPaidProposal } from "./progress";

const none = { gsaDraftedAt: null, gsaSentAt: null, gsaSignedAt: null };

describe("GSA progress", () => {
  it("reads the paid proposal agreement from onboarding data", () => {
    const paid = readPaidProposal({
      proposalAcceptance: { payment: { status: "paid", amount: 1075, currency: "usd", paidAt: "2026-11-20T14:14:00.000Z" } },
      proposalBuilderState: { services: { tierLabel: "Grow" } },
    });
    expect(paid).toEqual({ amount: 1075, currency: "USD", paidAt: new Date("2026-11-20T14:14:00.000Z"), tier: "Grow" });
  });

  it("tolerates missing or malformed onboarding data", () => {
    expect(readPaidProposal(null)).toEqual({ amount: null, currency: "USD", paidAt: null, tier: null });
    expect(readPaidProposal({ proposalAcceptance: { payment: { paidAt: "not a date", amount: "9" } } }).paidAt).toBeNull();
  });

  it("takes the furthest step reached and says what comes next", () => {
    const at = new Date("2026-11-20T00:00:00Z");
    expect(currentGsaStep(none)).toBeNull();
    expect(currentGsaStep({ ...none, gsaDraftedAt: at })).toBe("drafted");
    expect(currentGsaStep({ ...none, gsaDraftedAt: at, gsaSentAt: at })).toBe("sent");
    expect(currentGsaStep({ ...none, gsaSignedAt: at })).toBe("signed");
    expect(nextGsaAction(none)).toMatch(/^Draft the GSA/);
    expect(nextGsaAction({ ...none, gsaSentAt: at })).toBe("Get the GSA signed.");
  });

  it("counts waiting time from payment", () => {
    const paidAt = new Date("2026-11-20T08:00:00Z");
    expect(hoursSincePaid(paidAt, new Date("2026-11-20T14:30:00Z"))).toBe(6);
    expect(hoursSincePaid(null, new Date())).toBe(0);
    expect(hoursSincePaid(paidAt, new Date("2026-11-19T00:00:00Z"))).toBe(0);
    expect(formatWaiting(6)).toBe("6h");
    expect(formatWaiting(47)).toBe("47h");
    expect(formatWaiting(73)).toBe("3d");
  });

  it("guesses the ripley folder from the company name", () => {
    expect(gsaFolderCandidates(null, "SJ Equity LLC")).toEqual(["sj-equity-llc", "sj-equity"]);
    expect(gsaFolderCandidates(null, "Rodan Properties LLC")).toEqual(["rodan-properties-llc", "rodan-properties"]);
    expect(gsaFolderCandidates("rodan-properties", "Rodan Properties LLC")[0]).toBe("rodan-properties");
    expect(gsaFolderCandidates(null, "Acme")).toEqual(["acme"]);
  });
});
