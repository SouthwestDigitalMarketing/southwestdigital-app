import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrandStatus } from "@prisma/client";
import { BrandProvider, type BrandContextValue } from "@/lib/brands/context";
import { annualServiceStartText } from "@/lib/quotes/serviceStart";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
// Staff preview keeps the agreement/payment state in useState. The overrides
// below are matched by occurrence order of each initial shape in a staff
// render (no engagement, effects never run under static markup):
// - 1st `null` is the selected tier, 10th `null` is the checkout summary;
// - 1st `0` is the step;
// - 4th `false` is hasTwelveMonthAgreement (after the two intro-video flags
//   and streamSdkReady). Earlier hooks only use function/boolean-true
//   initials, so they never match. Counts reset before every render.
const staffView = vi.hoisted(() => ({
  step: null as number | null,
  selectedTier: null as "maintain" | null,
  annual: false,
  signed: false,
  checkout: null as Record<string, unknown> | null,
  nullCount: 0,
  zeroCount: 0,
  falseCount: 0,
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: ((initial: unknown) => {
      if (initial === null) {
        staffView.nullCount += 1;
        if (staffView.selectedTier !== null && staffView.nullCount === 1) {
          return actual.useState(staffView.selectedTier);
        }
        if (staffView.checkout !== null && staffView.nullCount === 10) {
          return actual.useState(staffView.checkout);
        }
        return actual.useState(initial);
      }
      if (initial === 0 && staffView.step !== null) {
        staffView.zeroCount += 1;
        if (staffView.zeroCount === 1) return actual.useState(staffView.step);
        return actual.useState(initial);
      }
      if (initial === false && (staffView.annual || staffView.signed)) {
        staffView.falseCount += 1;
        // 4th false is hasTwelveMonthAgreement (after the two intro-video
        // flags and streamSdkReady); 9th false is alreadySigned.
        if (staffView.annual && staffView.falseCount === 4) return actual.useState(true);
        if (staffView.signed && staffView.falseCount === 9) return actual.useState(true);
        return actual.useState(initial);
      }
      return actual.useState(initial);
    }) as typeof actual.useState,
  };
});
vi.mock("@/app/(app)/offers/who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import OfferProposalPreview from "./OfferProposalPreview";
import { INITIAL_CONTACT_INFO } from "./ProposalContactInfoState";
import {
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";

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

function assessmentWith(overrides: Partial<AssessmentState>): AssessmentState {
  let state: AssessmentState;
  function Capture() {
    state = useProposalAssessmentDemoState({
      persist: false,
      initialAssessment: overrides,
    }).assessment;
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  return state!;
}

const StaffPreview = OfferProposalPreview as unknown as (props: {
  assessment: AssessmentState;
  initialContactInfo: typeof INITIAL_CONTACT_INFO;
  isStaffPreview: boolean;
}) => ReactNode;

function renderStaffPreview(
  assessment: AssessmentState,
  opts: {
    step?: number;
    tier?: "maintain";
    annual?: boolean;
    signed?: boolean;
    checkout?: Record<string, unknown>;
  } = {},
) {
  staffView.step = opts.step ?? null;
  staffView.selectedTier = opts.tier ?? null;
  staffView.annual = opts.annual ?? false;
  staffView.signed = opts.signed ?? false;
  staffView.checkout = opts.checkout ?? null;
  staffView.nullCount = 0;
  staffView.zeroCount = 0;
  staffView.falseCount = 0;
  return renderToStaticMarkup(
    // BrandProvider's types require `children` on the props object; eslint wants the opposite.
    // eslint-disable-next-line react/no-children-prop -- tsc vs react/no-children-prop
    createElement(BrandProvider, {
      value: brandValue,
      children: createElement(StaffPreview, {
        assessment,
        initialContactInfo: { ...INITIAL_CONTACT_INFO, companyName: "Example LLC" },
        isStaffPreview: true,
      }),
    }),
  );
}

beforeEach(() => {
  staffView.step = null;
  staffView.selectedTier = null;
  staffView.annual = false;
  staffView.signed = false;
  staffView.checkout = null;
});

describe("spec 06 staff preview fixes", () => {
  it("caps the embedded agreement fee line at the amount due", () => {
    const assessment = assessmentWith({ firstPaymentCredit: 5000, serviceStartMonth: "2026-12" });
    const html = renderStaffPreview(assessment, { step: 2, tier: "maintain" });
    // The agreement is on screen at the agreement step even before selection.
    expect(html).toContain("Total Due Upon Signing: $0.00");
    // The fee line shows the capped deduction ($500 onboarding + $250 first
    // month), never the raw $5,000 credit.
    expect(html).toContain("Credit for work already paid: -$750.00");
    expect(html).not.toContain("-$5,000.00");
  });

  it("reads the annual start sentence in the payment blurb on a 12-month term", () => {
    const assessment = assessmentWith({ firstPaymentCredit: 500, serviceStartMonth: "2026-12" });
    const html = renderStaffPreview(assessment, {
      step: 3,
      tier: "maintain",
      annual: true,
      signed: true,
      checkout: {
        tier: "maintain",
        tierLabel: "Maintain",
        hasTwelveMonthAgreement: true,
        selectedCleanupPeriodKeys: [],
        selectedAdditionalOptionIds: [],
        recurringMonthlyTotal: 200,
        cleanupTotal: 0,
        onboardingFee: 500,
        oneTimeTotal: 500,
        amountDueNow: 2400,
        creditApplied: 500,
        creditRemaining: 0,
        chargeKind: "annual",
        serviceStartMonth: "2026-12",
      },
    });
    expect(html).toContain(
      `Covers onboarding and prepays your first month. ${annualServiceStartText("2026-12")}`,
    );
    expect(html).not.toContain("Covers onboarding and prepays your first month. Service starts");
  });
});
