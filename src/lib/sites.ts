export type PublicSite = {
  host: string;
  url: string;
  group: "business" | "music" | "personal";
  use: string;
  status: "Live" | "Template";
  name?: string;
};

/** Extra sites on the Music and Website pages (Tom, 2026-11-28: focus on the wedding band;
 * southernrockguitarist.com and bluesbandforhire.com are left off, thomasgrantmacdonald.com
 * is shown). Business sites come from brand GA4 / BRAND_WEBSITES. */
export const MUSIC_SITES: PublicSite[] = [
  {
    host: "easyweddingband.com",
    url: "https://easyweddingband.com",
    group: "music",
    use: "Wedding band leads (solo, duo or four-piece)",
    status: "Live",
    name: "The Easy Wedding Band",
  },
  {
    host: "thomasgrantmacdonald.com",
    url: "https://thomasgrantmacdonald.com",
    group: "personal",
    use: "Tom's own site",
    status: "Live",
  },
];

export const MUSIC_MAIN = MUSIC_SITES[0];

export function publicHost(urlOrHost: string): string {
  const trimmed = urlOrHost.trim();
  if (!trimmed) return "";
  try {
    const href = /:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return trimmed.replace(/^www\./i, "").split("/")[0]?.toLowerCase() ?? "";
  }
}

export function publicHref(urlOrHost: string): string {
  const trimmed = urlOrHost.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "") || trimmed;
  return `https://${publicHost(trimmed)}`;
}
