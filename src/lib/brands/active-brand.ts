import { normalizeHostname } from "./hostname";

export const ACTIVE_BRAND_COOKIE = "swd-active-brand";
/** The existing BKC data scope under the Lochside LLC company dashboard. */
export const COMPANY_HOME_BRAND_SLUG = "bookkeeping-conroe";
export function isLochsideBrandSlug(slug: string): boolean {
  return slug === COMPANY_HOME_BRAND_SLUG || slug === "real-estate-bookkeeper";
}

export function platformHostname(platformBaseUrl: string | undefined): string | null {
  if (!platformBaseUrl) return null;
  try {
    return normalizeHostname(new URL(platformBaseUrl).hostname);
  } catch {
    return null;
  }
}

export function isPlatformHostname(
  rawHostname: string | null | undefined,
  platformBaseUrl: string | undefined,
): boolean {
  const requestHostname = normalizeHostname(rawHostname);
  const configuredHostname = platformHostname(platformBaseUrl);
  return Boolean(requestHostname && configuredHostname && requestHostname === configuredHostname);
}

