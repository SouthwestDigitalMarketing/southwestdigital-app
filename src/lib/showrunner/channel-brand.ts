import "server-only";

import { prisma } from "@/lib/prisma";
import { COMPANY_HOME_BRAND_SLUG, isLochsideBrandSlug } from "@/lib/brands/active-brand";

/** The YouTube channel Showrunner reports on for Lochside (Tom, 2026-11-24: only The Real Estate Bookkeeper). */
export const SHOW_CHANNEL_BRAND_SLUG = "real-estate-bookkeeper";

type BrandRef = { id: string; slug: string };

/**
 * Whose YouTube numbers and goals the Showrunner pages show: from either Lochside brand, always The Real Estate
 * Bookkeeper; any other brand keeps its own.
 */
export async function showChannelBrand(active: BrandRef): Promise<BrandRef> {
  if (!isLochsideBrandSlug(active.slug) || active.slug === SHOW_CHANNEL_BRAND_SLUG) return active;
  const channel = await prisma.brand.findUnique({ where: { slug: SHOW_CHANNEL_BRAND_SLUG }, select: { id: true, slug: true } });
  return channel ?? active;
}

/**
 * Whose short links the video descriptions carry, for click counts: from either Lochside brand, Bookkeeping
 * Conroe (bookkeepingconroe.com/s?, /b?), even on The Real Estate Bookkeeper channel's videos.
 */
export async function showLinksBrand(active: BrandRef): Promise<BrandRef> {
  if (!isLochsideBrandSlug(active.slug) || active.slug === COMPANY_HOME_BRAND_SLUG) return active;
  const home = await prisma.brand.findUnique({ where: { slug: COMPANY_HOME_BRAND_SLUG }, select: { id: true, slug: true } });
  return home ?? active;
}
