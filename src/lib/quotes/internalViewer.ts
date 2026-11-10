// Marks a browser as ours (Tom, staff) so opening a live client proposal never records a
// client view or activity. Set once per browser by opening any proposal link with
// ?internal=1; the cookie lives on the brand's proposal domain.
export const INTERNAL_VIEWER_COOKIE = "swapp_internal_viewer";
export const INTERNAL_VIEWER_PARAM = "internal";
const TWO_YEARS_SECONDS = 60 * 60 * 24 * 365 * 2;

export function hasInternalViewerCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => part.trim() === `${INTERNAL_VIEWER_COOKIE}=1`);
}

export function internalViewerCookieValue(): string {
  return `${INTERNAL_VIEWER_COOKIE}=1; Max-Age=${TWO_YEARS_SECONDS}; Path=/; SameSite=Lax; Secure`;
}
