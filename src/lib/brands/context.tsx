"use client";

import { createContext, useContext } from "react";
import type { AccountType, BrandRole, BrandStatus, MembershipStatus } from "@prisma/client";

export type BrandContextValue = {
  brand: {
    id: string;
    slug: string;
    name: string;
    status: BrandStatus;
    theme: {
      primaryColor: string;
      darkColor: string | null;
      accentColor: string;
      accentDarkColor: string | null;
      backgroundColor: string;
      foregroundColor: string;
      logoUrl: string | null;
      logoMarkUrl: string | null;
      logoDarkUrl: string | null;
      logoMarkDarkUrl: string | null;
      sidebarLogoType: string;
      logoAlt: string | null;
      mode: string;
      supportEmail: string | null;
      proposalFeaturedVideoUrl: string | null;
      proposalFeaturedImageUrl: string | null;
      proposalPrimaryColor: string | null;
      proposalAccentColor: string | null;
    } | null;
    toolLinks: Array<{
      key: string;
      label: string;
      url: string;
    }>;
  };
  membership: {
    id: string;
    role: BrandRole;
    status: MembershipStatus;
    accountType: AccountType | null;
    canAccessTickets: boolean;
    canUseFocus: boolean;
  } | null;
};

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({
  value,
  children,
}: {
  value: BrandContextValue;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used within BrandProvider");
  return ctx;
}
