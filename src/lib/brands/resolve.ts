import { prisma } from "@/lib/prisma";
import { BrandStatus } from "@prisma/client";
import { mergeToolLinks, visibleToolLinks } from "@/lib/brands/tools";

const BRAND_THEME_SELECT = {
  primaryColor: true,
  darkColor: true,
  accentColor: true,
  backgroundColor: true,
  foregroundColor: true,
  logoUrl: true,
  logoMarkUrl: true,
  logoDarkUrl: true,
  logoMarkDarkUrl: true,
  sidebarLogoType: true,
  logoAlt: true,
  mode: true,
  supportEmail: true,
  proposalFeaturedVideoUrl: true,
  proposalFeaturedImageUrl: true,
  proposalPrimaryColor: true,
  proposalAccentColor: true,
} as const;

const DEV_FALLBACK_SLUG = process.env.DEV_BRAND_SLUG ?? "bc";

const BRAND_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  theme: {
    select: BRAND_THEME_SELECT,
  },
  toolLinks: {
    select: { key: true, label: true, url: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
} as const;

export type ResolvedBrand = NonNullable<Awaited<ReturnType<typeof resolveBrand>>>;

async function loadResolvedBrand(brandId: string, userId?: string) {
  const [brand, membership] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: brandId },
      select: BRAND_SELECT,
    }),
    userId
      ? prisma.brandMembership.findUnique({
          where: { brandId_userId: { brandId, userId } },
          select: {
            id: true,
            role: true,
            status: true,
            accountType: true,
            canAccessTickets: true,
            canUseFocus: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!brand || brand.status === BrandStatus.DELETED) return null;

  const { toolLinks: storedToolLinks, ...brandFields } = brand;
  return {
    brand: {
      ...brandFields,
      toolLinks: visibleToolLinks(mergeToolLinks(storedToolLinks)),
    },
    membership,
  };
}

export async function resolveBrandById(brandId: string, userId: string) {
  return loadResolvedBrand(brandId, userId);
}

export async function resolveBrand(hostname: string | null, userId: string) {
  let brandId: string | null = null;

  if (hostname) {
    const domain = await prisma.brandDomain.findUnique({
      where: { hostname },
      select: { brandId: true, brand: { select: { status: true } } },
    });
    if (domain?.brand.status === BrandStatus.ACTIVE) {
      brandId = domain.brandId;
    }
  }

  if (!brandId && process.env.NODE_ENV === "development") {
    const fallback = await prisma.brand.findUnique({
      where: { slug: DEV_FALLBACK_SLUG },
      select: { id: true, status: true },
    });
    if (fallback?.status === BrandStatus.ACTIVE) {
      brandId = fallback.id;
    }
  }

  if (!brandId) return null;
  return loadResolvedBrand(brandId, userId);
}

export async function resolvePublicBrand(hostname: string | null) {
  let brandId: string | null = null;

  if (hostname) {
    const domain = await prisma.brandDomain.findUnique({
      where: { hostname },
      select: { brandId: true, brand: { select: { status: true } } },
    });
    if (domain?.brand.status === BrandStatus.ACTIVE) {
      brandId = domain.brandId;
    }
  }

  if (!brandId && process.env.NODE_ENV === "development") {
    const fallback = await prisma.brand.findUnique({
      where: { slug: DEV_FALLBACK_SLUG },
      select: { id: true, status: true },
    });
    if (fallback?.status === BrandStatus.ACTIVE) {
      brandId = fallback.id;
    }
  }

  if (!brandId) return null;

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      theme: { select: BRAND_THEME_SELECT },
      toolLinks: {
        select: { key: true, label: true, url: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!brand || brand.status !== BrandStatus.ACTIVE) return null;

  const { toolLinks: storedToolLinks, ...brandFields } = brand;
  return {
    ...brandFields,
    toolLinks: visibleToolLinks(mergeToolLinks(storedToolLinks)),
  };
}
