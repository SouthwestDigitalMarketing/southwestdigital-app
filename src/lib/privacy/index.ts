/**
 * App-wide privacy mode for screen recordings (Tom, 2026-11-20: one switch for the
 * whole app). The choice lives in a cookie so the server can hide names before
 * anything is sent. ripley's Reports pages use a cookie of the same name on their
 * own host; SWapp passes the setting along each time it opens Reports.
 */
export const PRIVACY_COOKIE = "swapp_privacy";

export function privacyOn(value: string | undefined): boolean {
  return value === "1";
}

/**
 * Pages that hide client names themselves when privacy is on. Every other page is
 * blurred by the shell until it is added here.
 */
export const PRIVACY_COVERED_PATHS = ["/dashboard", "/scorecard", "/reports", "/donna/activity"];

export function privacyCovers(pathname: string): boolean {
  return PRIVACY_COVERED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
