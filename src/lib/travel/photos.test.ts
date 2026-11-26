import { afterEach, describe, expect, it, vi } from "vitest";
import { findPlacePhoto, geocode, lookupPlace, pagePhoto } from "./photos";

function answer(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body });
}

afterEach(() => vi.unstubAllGlobals());

describe("findPlacePhoto", () => {
  it("returns the lead photo without tracking parameters", async () => {
    const fetch = answer({
      query: { pages: [{ thumbnail: { source: "https://upload.wikimedia.org/x/960px-Fukuoka.jpg?utm_source=api" } }] },
    });
    vi.stubGlobal("fetch", fetch);
    expect(await findPlacePhoto("Fukuoka, Japan")).toBe("https://upload.wikimedia.org/x/960px-Fukuoka.jpg");
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.hostname).toBe("en.wikipedia.org");
    expect(url.searchParams.get("gsrsearch")).toBe("Fukuoka, Japan");
  });

  it("ignores photos from other hosts", async () => {
    vi.stubGlobal("fetch", answer({ query: { pages: [{ thumbnail: { source: "https://evil.example/a.jpg" } }] } }));
    expect(await findPlacePhoto("Anywhere")).toBeNull();
  });

  it("returns null with no match, a bad answer, or a network failure", async () => {
    vi.stubGlobal("fetch", answer({ query: { pages: [{}] } }));
    expect(await findPlacePhoto("Nowhere")).toBeNull();
    vi.stubGlobal("fetch", answer({}, false));
    expect(await findPlacePhoto("Nowhere")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    expect(await findPlacePhoto("Nowhere")).toBeNull();
    expect(await findPlacePhoto("   ")).toBeNull();
  });

  it("returns the article's coordinates with its photo", async () => {
    vi.stubGlobal(
      "fetch",
      answer({ query: { pages: [{ thumbnail: { source: "https://upload.wikimedia.org/a.jpg" }, coordinates: [{ lat: 33.59, lon: 130.4 }] }] } }),
    );
    expect(await lookupPlace("Fukuoka")).toEqual({ photo: "https://upload.wikimedia.org/a.jpg", lat: 33.59, lng: 130.4 });
    vi.stubGlobal("fetch", answer({ query: { pages: [{ coordinates: [{ lat: 999, lon: 1 }] }] } }));
    expect(await lookupPlace("Bad")).toEqual({ photo: null, lat: null, lng: null });
  });
});

describe("geocode", () => {
  it("reads OpenStreetMap's first result and rejects nonsense", async () => {
    const fetch = answer([{ lat: "19.4194", lon: "-99.1628" }]);
    vi.stubGlobal("fetch", fetch);
    expect(await geocode("Roma Norte, Mexico City")).toEqual({ lat: 19.4194, lng: -99.1628 });
    expect(new URL(fetch.mock.calls[0][0]).hostname).toBe("nominatim.openstreetmap.org");
    vi.stubGlobal("fetch", answer([]));
    expect(await geocode("Nowhere")).toBeNull();
    vi.stubGlobal("fetch", answer([{ lat: "abc", lon: "1" }]));
    expect(await geocode("Nowhere")).toBeNull();
    expect(await geocode(" ")).toBeNull();
  });
});

function htmlPage(html: string, url = "https://gym.example.com/", contentType = "text/html; charset=utf-8") {
  return vi.fn().mockResolvedValue({
    ok: true,
    url,
    headers: new Headers({ "content-type": contentType }),
    body: new Response(html).body,
  });
}

describe("pagePhoto", () => {
  it("reads og:image, resolving relative links", async () => {
    vi.stubGlobal("fetch", htmlPage('<head><meta property="og:image" content="/img/box.jpg?a=1&amp;b=2"></head>'));
    expect(await pagePhoto("https://gym.example.com/")).toBe("https://gym.example.com/img/box.jpg?a=1&b=2");
  });

  it("falls back to twitter:image when an http image has no https copy", async () => {
    const page = await htmlPage(
      '<meta property="og:image" content="http://x.example.com/a.jpg"><meta name="twitter:image" content="https://cdn.example.com/b.jpg">',
    )();
    const fetch = vi.fn().mockResolvedValueOnce(page).mockResolvedValueOnce({ ok: false, headers: new Headers() });
    vi.stubGlobal("fetch", fetch);
    expect(await pagePhoto("https://cafe.example.com/")).toBe("https://cdn.example.com/b.jpg");
    expect(String(fetch.mock.calls[1][0])).toBe("https://x.example.com/a.jpg");
  });

  it("upgrades an http preview image when the https copy exists", async () => {
    const page = await htmlPage('<meta property="og:image" content="http://x.example.com/a.jpg">')();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(page).mockResolvedValueOnce({ ok: true, headers: new Headers({ "content-type": "image/jpeg" }) }),
    );
    expect(await pagePhoto("https://bar.example.com/")).toBe("https://x.example.com/a.jpg");
  });

  it("never fetches private or odd addresses", async () => {
    const fetch = htmlPage("<meta property='og:image' content='https://a.example.com/x.jpg'>");
    vi.stubGlobal("fetch", fetch);
    for (const link of ["http://gym.example.com/", "https://localhost/", "https://127.0.0.1/", "https://[::1]/", "https://intranet/", "not a url"]) {
      expect(await pagePhoto(link)).toBeNull();
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns null for non-HTML pages, redirects to private hosts, or no image", async () => {
    vi.stubGlobal("fetch", htmlPage("{}", "https://gym.example.com/", "application/json"));
    expect(await pagePhoto("https://gym.example.com/")).toBeNull();
    vi.stubGlobal("fetch", htmlPage("<meta property='og:image' content='https://a.example.com/x.jpg'>", "https://10.0.0.5/"));
    expect(await pagePhoto("https://gym.example.com/")).toBeNull();
    vi.stubGlobal("fetch", htmlPage("<p>hello</p>"));
    expect(await pagePhoto("https://gym.example.com/")).toBeNull();
  });
});
