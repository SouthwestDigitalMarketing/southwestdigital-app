import { prisma } from "@/lib/prisma";
import { BrandStatus } from "@prisma/client";

const DEV_FALLBACK_SLUG = process.env.DEV_BRAND_SLUG ?? "bc";

export type ResolvedBrand = NonNullable<Awaited<ReturnType<typeof resolveBrand>>>;

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

  const [brand, membership] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        theme: {
          select: {
            primaryColor: true,
            accentColor: true,
            backgroundColor: true,
            foregroundColor: true,
            logoUrl: true,
            logoAlt: true,
            supportEmail: true,
          },
        },
      },
    }),
    prisma.brandMembership.findUnique({
      where: { brandId_userId: { brandId, userId } },
      select: {
        id: true,
        role: true,
        status: true,
        accountType: true,
        canAccessTickets: true,
        canUseFocus: true,
      },
    }),
  ]);

  if (!brand) return null;

  return { brand, membership };
}
