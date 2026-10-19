/**
 * Two brands were renamed on 2026-10-19: `bc` is now `bookkeeping-conroe` and
 * `treb` is now `real-estate-bookkeeper`. Deployment environment variables
 * (`YOUTUBE_REFRESH_TOKEN_BC`, `CLOUDFLARE_API_BC`, ...) and the redirect-path
 * rules were keyed on the old slugs, so they are looked up by the old key. Both
 * the old and the new slug resolve to it, so the code works on either side of the
 * database rename and no environment variable has to be renamed.
 */
const LEGACY_SLUG: Readonly<Record<string, string>> = {
  "bookkeeping-conroe": "bc",
  "real-estate-bookkeeper": "treb",
};

/** The slug this brand carried before the rename, or the slug itself. */
export function legacyBrandSlug(slug: string): string {
  return LEGACY_SLUG[slug] ?? slug;
}

/** Suffix of per-brand environment variables, e.g. `BC` or `CONTIGO_ACCOUNTING`. */
export function brandEnvKey(slug: string): string {
  return legacyBrandSlug(slug).toUpperCase().replace(/-/g, "_");
}

export function isBookkeepingConroe(slug: string): boolean {
  return legacyBrandSlug(slug) === "bc";
}
