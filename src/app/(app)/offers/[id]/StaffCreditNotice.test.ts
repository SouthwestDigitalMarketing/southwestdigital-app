import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StaffCreditNotice from "./StaffCreditNotice";

function render(onboardingData: unknown) {
  return renderToStaticMarkup(createElement(StaffCreditNotice, { onboardingData } as never));
}

describe("staff credit notice", () => {
  it("reads the remainder frozen at acceptance", () => {
    const html = render({
      proposalAcceptance: { creditRemaining: 400, creditRemainingReason: "Credit for October" },
    });
    expect(html).toContain("Credit to apply on next invoice: $400.00 — Credit for October");
  });

  it("falls back to the stored checkout selection, then builder services", () => {
    expect(render({
      proposalAcceptance: { selection: { creditRemaining: 250, creditRemainingReason: "Fall work" } },
    })).toContain("Credit to apply on next invoice: $250.00 — Fall work");
    expect(render({
      proposalBuilderState: { services: { creditRemaining: 100 } },
    })).toContain("Credit to apply on next invoice: $100.00");
  });

  it("renders nothing without a remainder", () => {
    for (const onboardingData of [
      {},
      null,
      undefined,
      { proposalAcceptance: {} },
      { proposalAcceptance: { creditRemaining: 0, creditRemainingReason: "Credit for October" } },
      { proposalAcceptance: { selection: { creditRemaining: -5 } } },
      { proposalBuilderState: { services: {} } },
    ]) {
      expect(render(onboardingData)).toBe("");
    }
  });
});
