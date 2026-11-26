import "server-only";

/**
 * Photo and map position for a place name (Tom, 2026-11-25: photos on the options, then a map
 * of the places we call out). The best-matching English Wikipedia article gives both its lead
 * image (Wikimedia Commons, free licences) and its coordinates; OpenStreetMap's Nominatim fills the
 * position when Wikipedia has none (a neighbourhood, an address). Every miss, slow answer or odd
 * reply returns nulls; lookups are a nicety and must never block a save.
 */
const PHOTO_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const USER_AGENT = "SWapp-travel/1.0 (https://app.bookkeepingconroe.com)";

export type PlaceLookup = { photo: string | null; lat: number | null; lng: number | null };
const NONE: PlaceLookup = { photo: null, lat: null, lng: null };

function coordinate(value: unknown, limit: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}

export async function lookupPlace(name: string): Promise<PlaceLookup> {
  const query = name.trim();
  if (!query) return NONE;
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "1",
    prop: "pageimages|coordinates",
    piprop: "thumbnail",
    pithumbsize: "960",
    format: "json",
    formatversion: "2",
  }).toString();
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!response.ok) return NONE;
    const body = (await response.json()) as {
      query?: { pages?: Array<{ thumbnail?: { source?: string }; coordinates?: Array<{ lat?: unknown; lon?: unknown }> }> };
    };
    const page = body.query?.pages?.[0];
    let photo: string | null = null;
    if (page?.thumbnail?.source) {
      const parsed = new URL(page.thumbnail.source);
      if (parsed.protocol === "https:" && PHOTO_HOSTS.has(parsed.hostname)) {
        parsed.search = "";
        photo = parsed.toString();
      }
    }
    const lat = coordinate(page?.coordinates?.[0]?.lat, 90);
    const lng = coordinate(page?.coordinates?.[0]?.lon, 180);
    return { photo, lat: lat !== null && lng !== null ? lat : null, lng: lat !== null && lng !== null ? lng : null };
  } catch {
    return NONE;
  }
}

/** Kept for callers that only want the photo. */
export async function findPlacePhoto(name: string): Promise<string | null> {
  return (await lookupPlace(name)).photo;
}

/** Position for free text such as "Roma Norte, Mexico City" from OpenStreetMap (light use only). */
export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const text = query.trim();
  if (!text) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: text, format: "jsonv2", limit: "1" }).toString();
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const lat = coordinate(Number(rows?.[0]?.lat), 90);
    const lng = coordinate(Number(rows?.[0]?.lon), 180);
    return lat !== null && lng !== null ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/** Hosts a staff-entered link must never make the server fetch (loopback, private, link-local). */
function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^[\d.]+$/.test(host) || host.includes(":")) return false; // IP literals: names only
  return true;
}

const MAX_PAGE_BYTES = 512_000;

/**
 * The preview image a web page declares for itself (og:image / twitter:image), for spots such as
 * a gym or café whose own site has a photo. https pages on public hostnames only, 4 s, first 512 KB.
 */
export async function pagePhoto(link: string): Promise<string | null> {
  let page: URL;
  try {
    page = new URL(link);
  } catch {
    return null;
  }
  if (page.protocol !== "https:" || !isPublicHost(page.hostname)) return null;
  try {
    const response = await fetch(page, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(4000),
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok || !response.body || !(response.headers.get("content-type") ?? "").includes("html")) return null;
    const finalUrl = new URL(response.url || page.toString());
    if (finalUrl.protocol !== "https:" || !isPublicHost(finalUrl.hostname)) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_PAGE_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => undefined);
    const html = new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
    const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
    for (const wanted of ["og:image:secure_url", "og:image", "twitter:image"]) {
      for (const tag of tags) {
        const name = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
        const content = /\bcontent\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
        if (name !== wanted || !content) continue;
        const image = new URL(content.replace(/&amp;/g, "&"), finalUrl);
        if (!isPublicHost(image.hostname)) continue;
        if (image.protocol === "https:") return image.toString();
        // Many sites still list an http:// preview image; use it only if the https copy is really there.
        if (image.protocol === "http:") {
          image.protocol = "https:";
          const check = await fetch(image, { method: "HEAD", signal: AbortSignal.timeout(3000), cache: "no-store" }).catch(() => null);
          if (check?.ok && (check.headers.get("content-type") ?? "").startsWith("image/")) return image.toString();
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
