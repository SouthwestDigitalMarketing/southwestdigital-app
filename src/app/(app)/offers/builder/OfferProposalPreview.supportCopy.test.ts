import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BrandStatus } from "@prisma/client";
import { BrandProvider, type BrandContextValue } from "@/lib/brands/context";
import { supportCopyForPublish } from "@/lib/quotes/serviceLevels";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
// Same staff-preview useState override as OfferProposalPreview.spec06: the
// 1st `null` initial is the selected tier, the 1st `0` is the step. Counts
// reset before every render.
const staffView = vi.hoisted(() => ({
  step: null as number | null,
  selectedTier: null as "grow" | null,
  nullCount: 0,
  zeroCount: 0,
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
        return actual.useState(initial);
      }
      if (initial === 0 && staffView.step !== null) {
        staffView.zeroCount += 1;
        if (staffView.zeroCount === 1) return actual.useState(staffView.step);
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
import type { AssessmentState } from "./ProposalCreationWorkspaceDemo";

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

const StaffPreview = OfferProposalPreview as unknown as (props: {
  assessment: AssessmentState;
  initialContactInfo: typeof INITIAL_CONTACT_INFO;
  isStaffPreview: boolean;
  viewedQuote?: { supportCopy?: unknown; isPublished: boolean } | null;
}) => ReactNode;

// Legacy accepted snapshot: published/accepted before the frozen-copy wiring,
// so it carries no stored supportCopy but does carry Concierge support on
// the grow tier.
function legacyAcceptedAssessment(): AssessmentState {
  const raw = JSON.parse(
    readFileSync(join(__dirname, "__fixtures__", "02-accepted-published.snapshot.json"), "utf8"),
  ) as { assessment: AssessmentState };
  return raw.assessment;
}

function renderStaffPreview(
  viewedQuote?: { supportCopy?: unknown; isPublished: boolean } | null,
  step: number | null = 1,
) {
  staffView.step = step;
  staffView.selectedTier = step === 2 ? "grow" : null;
  staffView.nullCount = 0;
  staffView.zeroCount = 0;
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- tsc vs react/no-children-prop
    createElement(BrandProvider, {
      value: brandValue,
      children: createElement(StaffPreview, {
        assessment: legacyAcceptedAssessment(),
        initialContactInfo: { ...INITIAL_CONTACT_INFO, companyName: "Example LLC" },
        isStaffPreview: true,
        ...(viewedQuote === undefined ? {} : { viewedQuote }),
      }),
    }),
  );
}

beforeEach(() => {
  staffView.step = null;
  staffView.selectedTier = null;
  staffView.nullCount = 0;
  staffView.zeroCount = 0;
});

describe("staff preview of an existing published/accepted snapshot", () => {
  it("renders the legacy 24/7 copy with no WHAT'S INCLUDED when the snapshot predates the wiring", () => {
    const cards = renderStaffPreview({ isPublished: true });
    expect(cards).toContain(">24/7</strong>");
    expect(cards).not.toContain("2 business hours");
    expect(cards).not.toContain("The service agreement controls");
    const agreement = renderStaffPreview({ isPublished: true }, 2);
    expect(agreement).toContain("24/7");
    expect(agreement).not.toContain("2 business hours");
    expect(agreement).not.toContain("WHAT&#x27;S INCLUDED");
  });

  it("renders the frozen v2 copy with WHAT'S INCLUDED when the snapshot carries a stored copy", () => {
    const viewed = { supportCopy: supportCopyForPublish(), isPublished: true };
    const cards = renderStaffPreview(viewed);
    expect(cards).toContain(">2 business hours</strong>");
    expect(cards).not.toContain(">24/7</strong>");
    const agreement = renderStaffPreview(viewed, 2);
    expect(agreement).toContain("2 business hours");
    expect(agreement).toContain("WHAT&#x27;S INCLUDED");
  });

  it("previews the current copy for an unpublished draft", () => {
    const cards = renderStaffPreview(undefined);
    expect(cards).toContain(">2 business hours</strong>");
    const agreement = renderStaffPreview(undefined, 2);
    expect(agreement).toContain("WHAT&#x27;S INCLUDED");
  });

  it("previews the current copy for an existing but never-published draft", () => {
    const viewed = { supportCopy: undefined, isPublished: false };
    const cards = renderStaffPreview(viewed);
    expect(cards).toContain(">2 business hours</strong>");
    const agreement = renderStaffPreview(viewed, 2);
    expect(agreement).toContain("WHAT&#x27;S INCLUDED");
  });
});
