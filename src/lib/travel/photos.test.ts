import { afterEach, describe, expect, it, vi } from "vitest";
import { findPlacePhoto } from "./photos";

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
});
