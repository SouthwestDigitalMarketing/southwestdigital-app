import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ESTIMATE_NOTICE_TEXT, toPublicAccountInventory } from "@/lib/quotes/accountInventory";
import { BrandStatus } from "@prisma/client";
import { BrandProvider, type BrandContextValue } from "@/lib/brands/context";
import {
  catalogCopyFromRows,
  toPublicBookkeepingProposal,
  toPublicHourlyProposal,
} from "@/lib/quotes/publicProposal";
import {
  PRIVATE_SENTINEL,
  sentinelBookkeepingSnapshot,
  sentinelCatalogRows,
  sentinelHourlySnapshot,
} from "@/lib/quotes/publicProposalSentinel";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
// SSR has no clicks: open the package step to exercise the client-visible table.
const viewState = vi.hoisted(() => ({ pricingStep: false }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: ((initial: unknown) => actual.useState(viewState.pricingStep && initial === 0 ? 1 : initial)) as typeof actual.useState,
  };
});
afterEach(() => { viewState.pricingStep = false; });
vi.mock("@/app/(app)/offers/who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import OfferProposalPreview from "@/app/(app)/offers/builder/OfferProposalPreview";
import { firstMonthFullText, serviceStartText } from "@/lib/quotes/serviceStart";
import { HourlyPublicView } from "./HourlyPublicView";

const brandValue: BrandContextValue = {
  brand: {
    id: "brand",
    slug: "firm",
    name: "Southwest",
    status: BrandStatus.ACTIVE,
    theme: {
      lightColor: "#17324d",
      darkColor: null,
      accentColor: "#d79b3b",
      backgroundColor: "#ffffff",
      foregroundColor: "#0f172a",
      logoUrl: null,
      logoMarkUrl: null,
      logoDarkUrl: null,
      logoMarkDarkUrl: null,
      sidebarLogoType: "full",
      logoAlt: null,
      mode: "light",
      themePreset: "default",
      supportEmail: "help@example.test",
      proposalFeaturedVideoUrl: null,
      proposalFeaturedImageUrl: null,
      proposalLightColor: null,
      proposalAccentColor: null,
      accentForegroundColor: "#ffffff",
    },
    toolLinks: [],
  },
  membership: null,
};

function publicBookkeeping() {
  return toPublicBookkeepingProposal(
    sentinelBookkeepingSnapshot(),
    catalogCopyFromRows(sentinelCatalogRows),
  );
}

const LivePreview = OfferProposalPreview as unknown as (props: {
  publicProposal: ReturnType<typeof publicBookkeeping>;
  live: boolean;
  proposalToken: string;
}) => ReactNode;

function renderLiveBookkeeping(publicProposal: ReturnType<typeof publicBookkeeping>) {
  return renderToStaticMarkup(
    // BrandProvider's types require `children` on the props object; eslint wants the opposite.
    // eslint-disable-next-line react/no-children-prop -- tsc vs react/no-children-prop
    createElement(BrandProvider, {
      value: brandValue,
      children: createElement(LivePreview, {
        publicProposal,
        live: true,
        proposalToken: "token",
      }),
    }),
  );
}

describe("public proposal HTML", () => {
  it("renders sizing and terms from the explicit public inventory field", () => {
    viewState.pricingStep = true;
    const publicProposal = {
      ...publicBookkeeping(),
      accountInventory: toPublicAccountInventory([
        { id: "open", kind: "checking", label: "Public checking", last4: "1234", status: "open", monthlyTransactions: 150, basis: "estimated", source: PRIVATE_SENTINEL },
        { id: "closed", kind: "savings", label: "Closed hidden bank", status: "closed", monthlyTransactions: 9000, basis: "measured" },
      ]),
    };
    const html = renderLiveBookkeeping(publicProposal);
    expect(html).toContain("How we sized this");
    expect(html).toContain("Public checking ••1234");
    expect(html).toContain("150");
    expect(html).toContain(ESTIMATE_NOTICE_TEXT);
    expect(html).toContain("Volume-based pricing.");
    expect(html).not.toContain("Closed hidden bank");
    expect(html).not.toContain(PRIVATE_SENTINEL);
  });

  it("never restores sizing from raw assessment fields when the public field is absent", () => {
    viewState.pricingStep = true;
    const publicProposal = publicBookkeeping();
    Object.assign(publicProposal.assessment, {
      accounts: [{ id: "private", kind: "checking", label: PRIVATE_SENTINEL, status: "open", monthlyTransactions: 150, basis: "measured" }],
    });
    const legacyPublicProposal = { ...publicProposal, accountInventory: null };
    const html = renderLiveBookkeeping(legacyPublicProposal);
    expect(html).not.toContain("How we sized this");
    expect(html).not.toContain("Volume-based pricing.");
    expect(html).not.toContain(PRIVATE_SENTINEL);
  });

  it("bookkeeping public HTML omits sentinel internals", () => {
    const publicProposal = publicBookkeeping();
    const html = renderLiveBookkeeping(publicProposal);
    expect(html).not.toContain(PRIVATE_SENTINEL);
    expect(html).toContain("Your bookkeeping plan");
  });

  it("pre-selection public terms show the whitelisted plan as an estimate", () => {
    viewState.pricingStep = true;
    const snapshot = sentinelBookkeepingSnapshot();
    const withPlan = {
      ...snapshot,
      assessment: {
        ...snapshot.assessment,
        booksOverTwoMonthsBehind: true,
        cleanupStartMonth: "2025-01",
        cleanupEndMonth: "2025-12",
        cleanupPlan: {
          caughtUpThrough: "2025-12",
          startDate: "2026-02-14",
          wrapUpDate: "2026-05-14",
          wrapUpSource: "default",
          paymentPlan: "monthly",
        },
      },
    };
    const html = renderLiveBookkeeping(
      toPublicBookkeepingProposal(withPlan, catalogCopyFromRows(sentinelCatalogRows)),
    );
    // The per-tier cards carry the plan terms before any selection.
    expect(html).toContain("12 months × $500.00/month");
    expect(html).toContain("caught up through December 2025");
    expect(html).toContain("Estimate \u2014");
    expect(html).toContain("installment");
    // Pre-selection reads the cleanup length, never the wrap-up calendar date.
    expect(html).toContain("about 13 weeks after you accept");
    expect(html).not.toContain("caught up through December 2025 by");
    // Staff-only fields never reach the live view.
    expect(html).not.toContain("2026-02-14");
    expect(html).not.toContain("wrapUpSource");
    expect(html).not.toContain(PRIVATE_SENTINEL);
  });

  it("pre-selection public cards state the start month and the credit remainder", () => {
    viewState.pricingStep = true;
    const snapshot = sentinelBookkeepingSnapshot();
    const withStart = {
      ...snapshot,
      assessment: {
        ...snapshot.assessment,
        firstPaymentCredit: 5000,
        firstPaymentCreditReason: "Credit for October work already paid",
        serviceStartMonth: "2026-12",
      },
    };
    const html = renderLiveBookkeeping(
      toPublicBookkeepingProposal(withStart, catalogCopyFromRows(sentinelCatalogRows)),
    );
    expect(html).toContain(serviceStartText("2026-12"));
    expect(html).toContain(firstMonthFullText());
    expect(html).toContain("Credit for October work already paid");
    expect(html).toContain("will be applied to your next invoice.");
    // Static markup escapes the apostrophe, so match the apostrophe-free tail.
    expect(html).not.toContain("includes your first month");
    expect(html).not.toContain(PRIVATE_SENTINEL);
  });

  it("pre-selection cleanup keeps only the relative start wording even with a staff month", () => {
    viewState.pricingStep = true;
    const snapshot = sentinelBookkeepingSnapshot();
    const withPlan = {
      ...snapshot,
      assessment: {
        ...snapshot.assessment,
        booksOverTwoMonthsBehind: true,
        cleanupStartMonth: "2025-01",
        cleanupEndMonth: "2025-12",
        serviceStartMonth: "2026-12",
        cleanupPlan: {
          caughtUpThrough: "2025-12",
          startDate: "2026-02-14",
          wrapUpDate: "2026-05-14",
          wrapUpSource: "default",
          paymentPlan: "monthly",
        },
      },
    };
    const html = renderLiveBookkeeping(
      toPublicBookkeepingProposal(withPlan, catalogCopyFromRows(sentinelCatalogRows)),
    );
    expect(html).toContain("about 13 weeks after you accept");
    expect(html).not.toContain("Service starts");
    expect(html).not.toContain(firstMonthFullText());
  });

  it("legacy public cards keep the confirmation wording with no start month", () => {
    viewState.pricingStep = true;
    const html = renderLiveBookkeeping(publicBookkeeping());
    expect(html).not.toContain("Service starts");
    expect(html).not.toContain("Remaining credit");
    expect(html).toContain("includes your first month");
  });

  it("pre-selection public estimate itemizes the complexity add and always adds up", () => {
    viewState.pricingStep = true;
    const snapshot = sentinelBookkeepingSnapshot();
    const withComplexity = {
      ...snapshot,
      assessment: {
        ...snapshot.assessment,
        booksOverTwoMonthsBehind: true,
        cleanupStartMonth: "2025-01",
        cleanupEndMonth: "2025-12",
        cleanupPlan: {
          caughtUpThrough: "2025-12",
          startDate: "2026-02-14",
          wrapUpDate: "2026-05-14",
          wrapUpSource: "default",
          paymentPlan: "monthly",
        },
      },
      pricing: {
        ...snapshot.pricing,
        maintain: {
          ...snapshot.pricing.maintain,
          complexity: { lines: [], monthlyTotal: 0, cleanupPerMonthTotal: 65, cleanupTotal: 780 },
        },
      },
    };
    const html = renderLiveBookkeeping(
      toPublicBookkeepingProposal(withComplexity, catalogCopyFromRows(sentinelCatalogRows)),
    );
    // 12 months × $500 base + $780 complexity add = $6,780 schedule.
    expect(html).toContain("Complexity adjustment: $780.00");
    expect(html).toContain("Estimated cleanup total:");
    expect(html).toContain("$6,780.00");
    expect(html).toContain("Estimate \u2014");
  });

  it("hourly public HTML omits sentinel internals", () => {
    const snapshot = sentinelHourlySnapshot();
    const html = renderToStaticMarkup(
      createElement(HourlyPublicView, toPublicHourlyProposal({
        snapshot,
        checkout: snapshot.checkoutSummary,
        brand: { name: "Southwest", accent: "#d79b3b" },
        agreementText: snapshot.agreementText,
        flags: {
          proposalToken: "token",
          engagementId: "eng",
          isTestProposal: false,
          alreadySigned: false,
          kindLabel: "Hourly consulting",
        },
      })),
    );
    expect(html).not.toContain(PRIVATE_SENTINEL);
    expect(html).toContain("Proposal for Example LLC");
    expect(html).toContain("alex@example.test");
  });

  it("live bookkeeping state JSON omits staff default keys", () => {
    const publicProposal = publicBookkeeping();
    const serialized = JSON.stringify(publicProposal);
    expect(serialized).not.toContain(PRIVATE_SENTINEL);
    expect(serialized).not.toContain("assessmentNotes");
    expect(serialized).not.toContain("payrollContactEmail");
    expect(serialized).not.toContain("invoicingEmail");
    expect(serialized).not.toContain("owner-1");
    expect(publicProposal.contactInfo.owners).toEqual([]);
  });

  it("live public hydration does not restore staff assessmentNotes or default owners", () => {
    const publicProposal = publicBookkeeping();
    const html = renderLiveBookkeeping(publicProposal);
    expect(html).not.toContain("assessmentNotes");
    expect(html).not.toContain("payrollContactEmail");
    expect(html).not.toContain("invoicingEmail");
    expect(html).not.toContain("owner-1");
    expect(JSON.stringify({ publicProposal, live: true })).not.toContain("owner-1");
  });
});
