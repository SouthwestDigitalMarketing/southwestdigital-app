import { afterEach, describe, expect, it, vi } from "vitest";
import { findPlacePhoto, geocode, lookupPlace } from "./photos";

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
