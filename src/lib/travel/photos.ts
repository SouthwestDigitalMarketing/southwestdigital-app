import "server-only";

/**
 * Finds a photo for a place name (Tom, 2026-11-25: "add photos to these options"). Uses the lead
 * image of the best-matching English Wikipedia article; the files live on Wikimedia Commons under
 * free licences. Returns null on no match, a slow answer, or anything unexpected; the photo is a
 * nicety and must never block a save.
 */
const PHOTO_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

export async function findPlacePhoto(name: string): Promise<string | null> {
  const query = name.trim();
  if (!query) return null;
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "1",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "960",
    format: "json",
    formatversion: "2",
  }).toString();
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "SWapp-travel/1.0 (https://app.bookkeepingconroe.com)" },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { query?: { pages?: Array<{ thumbnail?: { source?: string } }> } };
    const source = body.query?.pages?.[0]?.thumbnail?.source;
    if (!source) return null;
    const photo = new URL(source);
    if (photo.protocol !== "https:" || !PHOTO_HOSTS.has(photo.hostname)) return null;
    photo.search = "";
    return photo.toString();
  } catch {
    return null;
  }
}
