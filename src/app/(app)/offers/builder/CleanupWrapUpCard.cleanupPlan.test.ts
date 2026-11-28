import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CleanupWrapUpCard from "./CleanupWrapUpCard";
import type { CleanupPlan } from "@/lib/quotes/cleanupPlan";

const plan: CleanupPlan = {
  caughtUpThrough: "2026-03",
  startDate: "2026-02-14",
  wrapUpDate: "2026-05-14",
  wrapUpSource: "default",
  paymentPlan: "monthly",
};

describe("spec 04 builder wrap-up card client-sees note", () => {
  it("keeps the computed date and notes the client-facing length", () => {
    const html = renderToStaticMarkup(
      createElement(CleanupWrapUpCard, {
        plan,
        periods: [],
        onCreatePlan: () => {},
        onWrapUpChange: () => {},
        onResetWrapUp: () => {},
        onPaymentPlanChange: () => {},
      }),
    );
    expect(html).toContain("We will have your books caught up through March 2026 by May 14, 2026.");
    expect(html).toContain(
      "Client sees: We will have your books caught up through March 2026 about 13 weeks after you accept.",
    );
  });
});
