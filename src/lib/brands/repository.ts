import "server-only";
import {
  BrandRole,
  BrandStatus,
  DomainPurpose,
  DomainStatus,
  MembershipStatus,
  PlatformRole,
  UserStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeBrandAccess } from "./access";
import { normalizeHostname } from "./hostname";

const brandSummarySelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  theme: {
    select: {
      logoUrl: true,
      logoAlt: true,
      primaryColor: true,
      accentColor: true,
      backgroundColor: true,
      foregroundColor: true,
      supportEmail: true,
    },
  },
} as const;

export type BrandSummary = {
  id: string;
  slug: string;
  name: string;
  status: BrandStatus;
  theme: {
    logoUrl: string | null;
    logoAlt: string | null;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    foregroundColor: string;
    supportEmail: string | null;
  } | null;
};

export async function resolveAppBrandByHostname(
  rawHostname: string | null | undefined,
): Promise<BrandSummary | null> {
  const hostname = normalizeHostname(rawHostname);
  if (!hostname) return null;

  const domain = await prisma.brandDomain.findFirst({
    where: {
      hostname,
      purpose: DomainPurpose.APP,
      status: DomainStatus.VERIFIED,
      brand: { status: BrandStatus.ACTIVE },
    },
    select: { brand: { select: brandSummarySelect } },
  });

  return domain?.brand ?? null;
}

export async function getAccessibleBrands(
  userId: string,
  platformRole: PlatformRole,
): Promise<BrandSummary[]> {
  if (platformRole === PlatformRole.ADMIN || platformRole === PlatformRole.OWNER) {
    return prisma.brand.findMany({
      where: { status: { not: BrandStatus.DELETED } },
      select: brandSummarySelect,
      orderBy: { name: "asc" },
    });
  }

  const memberships = await prisma.brandMembership.findMany({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      brand: { status: BrandStatus.ACTIVE },
    },
    select: { brand: { select: brandSummarySelect } },
    orderBy: { brand: { name: "asc" } },
  });

  return memberships.map(({ brand }) => brand);
}

export async function getBrandAccessDecision(input: {
  brandId: string;
  userId: string;
  userStatus: UserStatus;
  platformRole: PlatformRole;
  minimumRole?: BrandRole;
}) {
  const brand = await prisma.brand.findUnique({
    where: { id: input.brandId },
    select: {
      status: true,
      memberships: {
        where: { userId: input.userId },
        select: { role: true, status: true },
        take: 1,
      },
    },
  });

  return authorizeBrandAccess({
    userStatus: input.userStatus,
    platformRole: input.platformRole,
    brandStatus: brand?.status ?? BrandStatus.DELETED,
    membership: brand?.memberships[0] ?? null,
    minimumRole: input.minimumRole,
  });
}
