import { normalizeHostname } from "./hostname";

export const ACTIVE_BRAND_COOKIE = "swd-active-brand";

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

