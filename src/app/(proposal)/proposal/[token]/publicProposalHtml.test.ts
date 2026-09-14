import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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
vi.mock("@/app/(app)/offers/who/actions", () => ({
  getOfferBuilderContextAction: async () => null,
  saveOfferDraftAction: async () => undefined,
  syncOfferContactsAction: async () => undefined,
}));

import OfferProposalPreview from "@/app/(app)/offers/builder/OfferProposalPreview";
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
  it("bookkeeping public HTML omits sentinel internals", () => {
    const publicProposal = publicBookkeeping();
    const html = renderLiveBookkeeping(publicProposal);
    expect(html).not.toContain(PRIVATE_SENTINEL);
    expect(html).toContain("Your bookkeeping plan");
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
