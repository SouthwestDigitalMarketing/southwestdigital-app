export type PublicSite = {
  host: string;
  url: string;
  group: "business" | "music";
  use: string;
  status: "Live" | "Template";
  name?: string;
};

/** Music sites (Tom, 2026-11-28). Business sites come from brand GA4 / BRAND_WEBSITES. */
export const MUSIC_SITES: PublicSite[] = [
  {
    host: "easyweddingband.com",
    url: "https://easyweddingband.com",
    group: "music",
    use: "Wedding band leads (four-piece or solo guitar)",
    status: "Live",
    name: "The Easy Wedding Band",
  },
  {
    host: "southernrockguitarist.com",
    url: "https://southernrockguitarist.com",
    group: "music",
    use: "Tom as a solo guitarist",
    status: "Live",
  },
  {
    host: "bluesbandforhire.com",
    url: "https://bluesbandforhire.com",
    group: "music",
    use: "To point at easyweddingband.com",
    status: "Template",
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
