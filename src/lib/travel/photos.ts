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
