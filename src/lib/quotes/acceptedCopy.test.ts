import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sentinelBookkeepingSnapshot } from "./publicProposalSentinel";
import { buildProposalCheckoutSummary } from "@/lib/engagements/proposalCheckout";

const mocks = vi.hoisted(() => ({ quote: vi.fn(), patch: vi.fn(), quoteUpdate: vi.fn(), quoteUpdateMany: vi.fn(), view: vi.fn(), domains: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  quote: { findFirst: mocks.quote, update: mocks.quoteUpdate, updateMany: mocks.quoteUpdateMany },
  brandDomain: { findMany: mocks.domains },
  $executeRaw: mocks.patch,
  proposalViewEvent: { create: mocks.view, createMany: vi.fn() },
} }));
vi.mock("next/headers", () => ({ headers: async () => { throw new Error("no request scope in tests"); } }));
import {
  acceptedCopyErrorReason,
  assertFetchedProposalUrl,
  assertProposalContentMarkers,
  decodeAcceptedCopyHtml,
  decodeMarkerEntities,
  extractStylesheetHrefs,
  fetchAndBuildAcceptedCopy,
  neutralizeProposalEndpoints,
  proposalCopyUrl,
  readAcceptedCopy,
  readAcceptedCopyLastError,
  resolveAllowedCopyOrigin,
  sanitizeFetchedProposalHtml,
  saveAcceptedCopy,
} from "./acceptedCopy";

const snapshot = sentinelBookkeepingSnapshot();
const selection = buildProposalCheckoutSummary(snapshot, { tier: "maintain", hasTwelveMonthAgreement: true,
  selectedCleanupPeriodKeys: [], selectedAdditionalOptionIds: ["reports"] });
const signedAt = new Date("2026-11-27T12:00:00Z");
const TOKEN = "tok-live-123";
function engagement() {
  return { id: "eng", brandId: "brand", status: "SIGNED", signedAt, onboardingFeeStatus: "PAID",
    onboardingData: {
      other: { untouched: true },
      proposalAcceptance: { selection, signedAt: signedAt.toISOString() },
    } };
}
function row(overrides = {}) {
  return { id: "quote", status: "accepted", publicToken: TOKEN,
    client: { name: "Alex Example", company: "Example LLC" },
    engagement: engagement(), ...overrides };
}

const PAGE_HTML = `<!doctype html><html><head>
<link rel="stylesheet" href="/_next/static/css/app.abc123.css">
<link rel="icon" href="/favicon.ico">
<script src="/_next/static/chunks/app.js"></script>
<script>fetch("/api/proposal/track",{method:"POST"})</script>
</head><body>
<main><h1>Your bookkeeping plan</h1><p>Prepared for Example LLC</p><p>Maintain plan — Essentials Momentum Advisory $321.09</p>
<a href="/proposal/${TOKEN}/select">Choose</a>
<form action="/api/proposal/eng/payment-intent" method="POST"><button>Pay with stripe</button></form>
<img src="https://evil.test/pixel.png" alt="Tracker">
<img src="https://cdn.test/logo.png" alt="Firm logo">
<video src="https://evil.test/v.mp4"></video>
<div onload="steal()" onclick="go()">Compare everything included</div>
<a href="https://paypal.com/pay">paypal</a>
<script src="https://www.clarity.ms/tag/x.js"></script>
</main></body></html>`;
const CSS_TEXT = `@import url("https://fonts.test/x.css"); .plan{color:red;background:url(https://evil.test/bg.png)}`;

// Records every request the copy pipeline makes. The fetched page must never
// trigger another copy: only the public page URL plus its stylesheets.
function fetchHarness(pageHtml = PAGE_HTML, cssByUrl: Record<string, string | null> = { "/_next/static/css/app.abc123.css": CSS_TEXT }) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/proposal/")) {
      return new Response(pageHtml, { status: 200, headers: { "content-type": "text/html" } });
    }
    const path = new URL(String(url)).pathname;
    const css = cssByUrl[path] ?? null;
    if (css === null) return new Response("missing", { status: 404 });
    return new Response(css, { status: 200, headers: { "content-type": "text/css" } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.quote.mockResolvedValue(row());
  mocks.domains.mockResolvedValue([{ hostname: "brand.test", isPrimary: true }]);
  mocks.patch.mockResolvedValue(1);
});

describe("self-fetch request", () => {
  it("carries the internal marker in the URL and the cookie, and hits only the public page plus CSS", async () => {
    const { calls, fetchImpl } = fetchHarness();
    const copy = await fetchAndBuildAcceptedCopy({ origin: "https://brand.test", token: TOKEN,
      quoteId: "quote", source: "backfill", selection: selection as unknown as Record<string, unknown>, fetchImpl,
      savedAt: signedAt });
    expect(calls).toHaveLength(2);
    const [page, css] = calls;
    expect(page.url).toBe(proposalCopyUrl("https://brand.test", TOKEN));
    expect(page.url).toContain("?internal=1");
    expect((page.init?.headers as Record<string, string>).Cookie).toBe("swapp_internal_viewer=1");
    expect(new URL(css.url).pathname).toBe("/_next/static/css/app.abc123.css");
    expect((css.init?.headers as Record<string, string>).Cookie).toBe("swapp_internal_viewer=1");
    expect(copy.sourceUrlPath).not.toContain("?");
    expect(copy.cssInlined).toBe(true);
  });
  it("flags cssInlined=false when a stylesheet cannot be fetched, and still saves the rest", async () => {
    const { fetchImpl } = fetchHarness(PAGE_HTML, { "/_next/static/css/app.abc123.css": null });
    const copy = await fetchAndBuildAcceptedCopy({ origin: "https://brand.test", token: TOKEN,
      quoteId: "quote", source: "accept", selection: selection as unknown as Record<string, unknown>, fetchImpl });
    expect(copy.cssInlined).toBe(false);
    expect(decodeAcceptedCopyHtml(copy)).toContain("Your bookkeeping plan");
  });
  it("fails closed on a bad page response without leaking the token", async () => {
    const { calls } = fetchHarness();
    const bad = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    try {
      await fetchAndBuildAcceptedCopy({ origin: "https://brand.test", token: TOKEN,
        quoteId: "quote", source: "backfill", selection: selection as unknown as Record<string, unknown>, fetchImpl: bad });
      expect.unreachable();
    } catch (error) {
      expect(String((error as Error).message)).toContain("quote quote");
      expect(String((error as Error).message)).not.toContain(TOKEN);
    }
    expect(calls).toHaveLength(0);
  });
});

describe("sanitized document", () => {
  const build = async (html = PAGE_HTML) => {
    const { fetchImpl } = fetchHarness(html);
    return fetchAndBuildAcceptedCopy({ origin: "https://brand.test", token: TOKEN,
      quoteId: "quote", source: "backfill", selection: selection as unknown as Record<string, unknown>, fetchImpl,
      savedAt: signedAt });
  };
  it("serves the real page content with inlined styles and a verifiable digest", async () => {
    const copy = await build();
    const decoded = decodeAcceptedCopyHtml(copy);
    expect(decoded).toContain("Your bookkeeping plan");
    expect(decoded).toContain("Essentials");
    expect(decoded).toContain("Compare everything included");
    expect(decoded).toContain("<style>");
    expect(decoded).toContain(".plan{color:red");
    expect(decoded).not.toContain("@import");
    expect(decoded).not.toContain("evil.test");
    expect(copy.sha256).toBe(createHash("sha256").update(decoded, "utf8").digest("hex"));
    expect(gzipSync(Buffer.from(decoded, "utf8")).toString("base64")).toBe(copy.html);
    expect(readAcceptedCopy({ acceptedProposalCopy: copy })).toEqual(copy);
    const tamperedHtml = decodeAcceptedCopyHtml(copy).replace("Essentials", "Tampered");
    const tampered = gzipSync(Buffer.from(tamperedHtml, "utf8")).toString("base64");
    expect(readAcceptedCopy({ acceptedProposalCopy: { ...copy, html: tampered } })).toBeNull();
  });
  it("has no executable markup, handlers, tracking or payment endpoints", async () => {
    const decoded = decodeAcceptedCopyHtml(await build());
    expect(decoded).not.toMatch(/<script\b/i);
    expect(decoded).not.toMatch(/<iframe|<video|<form\b/i);
    expect(decoded).not.toMatch(/\son\w+=/i);
    expect(decoded).not.toMatch(/\/api\/proposal/);
    expect(decoded).not.toMatch(/payment-intent|stripe\.com|paypal\.com|clarity\.ms/);
    expect(decoded).not.toMatch(/\b(?:href|src|srcset|action|formaction)=/i);
    expect(decoded).toContain("[Tracker]");
    expect(decoded).toContain("[Firm logo]");
  });
  it("keeps stored selection amounts without recalculation", async () => {
    const copy = await build();
    expect(copy.selection).toEqual(JSON.parse(JSON.stringify(selection)));
    expect(copy.quoteId).toBe("quote");
    expect(copy.version).toBe(2);
    expect(copy.encoding).toBe("gzip+base64");
  });
});

describe("sanitizer units", () => {
  it("extracts only stylesheet links", () => {
    expect(extractStylesheetHrefs(PAGE_HTML)).toEqual(["/_next/static/css/app.abc123.css"]);
    expect(proposalCopyUrl("https://brand.test/", TOKEN)).toBe(`https://brand.test/proposal/${TOKEN}?internal=1`);
  });
  it("strips scripts, handlers and remote loads", () => {
    const clean = sanitizeFetchedProposalHtml(`<div onload="x"><script>alert(1)</script><a href="/x">go</a></div>`);
    expect(clean).not.toMatch(/script|onload|href=/i);
    expect(clean).toContain("go");
  });
  it("neutralizes endpoint strings that survive as text", () => {
    const clean = neutralizeProposalEndpoints(`{"u":"/api/proposal/track","p":"payment-intent","s":"https://stripe.com/x"}`);
    expect(clean).not.toMatch(/\/api\/proposal\/track|payment-intent|stripe\.com/);
    expect(clean).toContain("[removed]");
  });
});

describe("accepted copy persistence", () => {
  const save = (fetchImpl?: typeof fetch) => saveAcceptedCopy({ brandId: "brand", quoteId: "quote",
    source: "backfill", origin: "https://brand.test", ...(fetchImpl ? { fetchImpl } : {}) });
  it("patches only engagement JSON, never Quote, status, updatedAt, view events or sends", async () => {
    const { calls, fetchImpl } = fetchHarness();
    await save(fetchImpl);
    expect(calls.filter((call) => call.url.includes("/proposal/"))).toHaveLength(1);
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    const [sql, json, id, brandId] = mocks.patch.mock.calls[0];
    expect(sql.join("?")).toContain('UPDATE "Engagement"');
    expect(sql.join("?")).toContain("AND NOT");
    expect(sql.join("?")).not.toMatch(/updatedAt|SET.*status|UPDATE.*quotes/);
    expect(JSON.parse(json)).toMatchObject({ version: 2, encoding: "gzip+base64", source: "backfill", quoteId: "quote", cssInlined: true });
    const stored = JSON.parse(json);
    expect(stored.sha256).toBe(createHash("sha256").update(decodeAcceptedCopyHtml(stored), "utf8").digest("hex"));
    expect(stored.selection).toEqual(JSON.parse(JSON.stringify(selection)));
    expect([id, brandId]).toEqual(["eng", "brand"]);
    expect(mocks.quoteUpdate).not.toHaveBeenCalled();
    expect(mocks.quoteUpdateMany).not.toHaveBeenCalled();
    expect(mocks.view).not.toHaveBeenCalled();
  });
  it("backfills a completed (paid) quote without touching Quote, status, updatedAt or views", async () => {
    mocks.quote.mockResolvedValue({ ...row(), status: "completed" });
    const { calls, fetchImpl } = fetchHarness();
    await save(fetchImpl);
    expect(calls.filter((call) => call.url.includes("/proposal/"))).toHaveLength(1);
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    const [sql, json, id, brandId] = mocks.patch.mock.calls[0];
    expect(sql.join("?")).toContain('UPDATE "Engagement"');
    expect(sql.join("?")).not.toMatch(/updatedAt|SET.*status|UPDATE.*quotes/);
    const stored = JSON.parse(json);
    expect(stored).toMatchObject({ version: 2, encoding: "gzip+base64", source: "backfill", quoteId: "quote" });
    expect(stored.sha256).toBe(createHash("sha256").update(decodeAcceptedCopyHtml(stored), "utf8").digest("hex"));
    expect(stored.selection).toEqual(JSON.parse(JSON.stringify(selection)));
    expect(decodeAcceptedCopyHtml(stored)).toContain("Example LLC");
    expect([id, brandId]).toEqual(["eng", "brand"]);
    expect(mocks.quoteUpdate).not.toHaveBeenCalled();
    expect(mocks.quoteUpdateMany).not.toHaveBeenCalled();
    expect(mocks.view).not.toHaveBeenCalled();
  });
  it("a second backfill never refetches or overwrites an existing copy, including unknown formats", async () => {
    const { calls, fetchImpl } = fetchHarness();
    await save(fetchImpl);
    const json = JSON.parse(mocks.patch.mock.calls[0][1]);
    mocks.quote.mockResolvedValue({ ...row(), engagement: { ...row().engagement, onboardingData: { acceptedProposalCopy: json } } });
    await save(fetchImpl);
    expect(calls.filter((call) => call.url.includes("/proposal/"))).toHaveLength(1);
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    mocks.quote.mockResolvedValue({ ...row(), engagement: { ...row().engagement, onboardingData: { acceptedProposalCopy: { version: 99 } } } });
    await save(fetchImpl);
    expect(mocks.patch).toHaveBeenCalledTimes(1);
  });
  it("fails closed for missing ownership, unaccepted quotes, missing token and missing selection", async () => {
    const { fetchImpl } = fetchHarness();
    mocks.quote.mockResolvedValueOnce(null);
    await expect(save(fetchImpl)).rejects.toThrow("not found");
    mocks.quote.mockResolvedValueOnce({ ...row(), status: "sent",
      engagement: { ...row().engagement, signedAt: null, status: "DRAFT", onboardingFeeStatus: null, onboardingData: {} } });
    await expect(save(fetchImpl)).rejects.toThrow("Only accepted");
    mocks.quote.mockResolvedValueOnce({ ...row(), publicToken: null });
    await expect(save(fetchImpl)).rejects.toThrow("not found");
    mocks.quote.mockResolvedValueOnce({ ...row(), engagement: { ...row().engagement, onboardingData: {} } });
    await expect(save(fetchImpl)).rejects.toThrow("selection is missing");
    expect(mocks.patch).not.toHaveBeenCalled();
  });
});

function stubFetch(
  pages: Record<string, { url: string; html: string; status?: number }>,
  assets: Record<string, { mime: string; bytes: Uint8Array } | null> = {},
) {
  return (async (rawUrl: unknown) => {
    const href = String(rawUrl);
    for (const [path, page] of Object.entries(pages)) {
      if (href.includes(path)) {
        const status = page.status ?? 200;
        return {
          ok: status >= 200 && status < 300,
          status,
          url: page.url,
          text: async () => page.html,
          headers: new Headers({ "content-type": "text/html" }),
        };
      }
    }
    const path = new URL(href).pathname;
    const asset = assets[path] ?? null;
    if (!asset) {
      return { ok: false, status: 404, url: href, text: async () => "missing", headers: new Headers() };
    }
    return {
      ok: true,
      status: 200,
      url: href,
      text: async () => "",
      arrayBuffer: async () => asset.bytes,
      headers: new Headers({ "content-type": asset.mime }),
    };
  }) as unknown as typeof fetch;
}

const MARKERS = { identity: ["Example LLC"], plan: ["Maintain"] };
const VALID_URL = `https://brand.test/proposal/${TOKEN}?internal=1`;

function buildValidated(
  html: string,
  url: string,
  assets: Record<string, { mime: string; bytes: Uint8Array } | null> = {},
  cssByPath: Record<string, string> = { "/app.abc123.css": CSS_TEXT },
) {
  const pages: Record<string, { url: string; html: string }> = { "/proposal/": { url, html } };
  for (const [path, css] of Object.entries(cssByPath)) {
    pages[path] = { url: `https://brand.test/_next/static/css${path}`, html: css };
  }
  return fetchAndBuildAcceptedCopy({
    origin: "https://brand.test", token: TOKEN, quoteId: "quote", source: "backfill",
    selection: selection as unknown as Record<string, unknown>,
    fetchImpl: stubFetch(pages, assets),
    allowedHosts: ["brand.test"], expectedMarkers: MARKERS, savedAt: signedAt,
  });
}

describe("brand origin allowlist", () => {
  it("refuses a request-derived origin that is not on the brand's host allowlist", async () => {
    const { fetchImpl } = fetchHarness();
    try {
      await saveAcceptedCopy({ brandId: "brand", quoteId: "quote", source: "backfill",
        origin: "https://evil.test", fetchImpl });
      expect.unreachable();
    } catch (error) {
      expect(String((error as Error).message)).toContain("quote quote");
      expect(String((error as Error).message)).not.toContain("evil");
    }
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    const [sql, json, id, brandId] = mocks.patch.mock.calls[0];
    expect(sql.join("?")).toContain("'{acceptedProposalCopyLastError}'");
    expect(sql.join("?")).not.toContain("'{acceptedProposalCopy}'");
    expect(sql.join("?")).not.toMatch(/updatedAt|SET.*status/);
    expect(JSON.parse(json)).toMatchObject({ reason: "validation-failed" });
    expect(JSON.parse(json).at).toEqual(expect.any(String));
    expect([id, brandId]).toEqual(["eng", "brand"]);
  });
  it("accepts the brand's own origin and resolves the brand host by default", () => {
    expect(resolveAllowedCopyOrigin("https://brand.test", ["brand.test"], "quote")).toBe("https://brand.test");
    expect(() => resolveAllowedCopyOrigin("https://evil.test", ["brand.test"], "quote")).toThrow("quote quote");
  });
  it("fails closed when the brand has no verified proposal host", async () => {
    mocks.domains.mockResolvedValue([]);
    const { fetchImpl } = fetchHarness();
    await expect(saveAcceptedCopy({ brandId: "brand", quoteId: "quote", source: "backfill", fetchImpl }))
      .rejects.toThrow("no verified proposal host");
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    const [sql, json, id, brandId] = mocks.patch.mock.calls[0];
    expect(sql.join("?")).toContain("'{acceptedProposalCopyLastError}'");
    expect(sql.join("?")).not.toContain("'{acceptedProposalCopy}'");
    expect(JSON.parse(json)).toMatchObject({ reason: "no-verified-domain" });
    expect([id, brandId]).toEqual(["eng", "brand"]);
  });
});

describe("proposal validation (fail closed)", () => {
  it("stores a valid page on the allowed host with marker evidence", async () => {
    const copy = await buildValidated(PAGE_HTML, VALID_URL);
    expect(copy.assetsInlined).toEqual({ images: 0, fonts: 0, skipped: 0 });
    expect(copy.cssInlined).toBe(true);
    expect(decodeAcceptedCopyHtml(copy)).toContain("Example LLC");
  });
  it("refuses a final URL on the wrong host", async () => {
    try {
      await buildValidated(PAGE_HTML, `https://evil.test/proposal/${TOKEN}?internal=1`);
      expect.unreachable();
    } catch (error) {
      expect(String((error as Error).message)).toContain("quote quote");
      expect(String((error as Error).message)).not.toContain(TOKEN);
    }
  });
  it("refuses a redirect to a login/protection page", async () => {
    const protection = `<!doctype html><html><head><title>Authenticating</title></head><body><main><div>Verifying you are human…</div></main></body></html>`;
    try {
      await buildValidated(protection, "https://brand.test/login?next=%2Fproposal%2Ftok");
      expect.unreachable();
    } catch (error) {
      expect(String((error as Error).message)).toContain("quote quote");
      expect(String((error as Error).message)).not.toContain(TOKEN);
    }
  });
  it("refuses a page without the quote's own markers", async () => {
    try {
      await buildValidated(`<!doctype html><html><body><main><div>Something else</div></main></body></html>`, VALID_URL);
      expect.unreachable();
    } catch (error) {
      expect(String((error as Error).message)).toContain("quote quote");
    }
  });
  it("refuses a wrong proposal path on the allowed host", async () => {
    try {
      await buildValidated(PAGE_HTML, "https://brand.test/proposal/other-token?internal=1");
      expect.unreachable();
    } catch (error) {
      expect(String((error as Error).message)).toContain("quote quote");
    }
  });
  it("assertFetchedProposalUrl ignores the empty final URL of a non-network harness", () => {
    expect(() => assertFetchedProposalUrl("", { allowedHosts: ["brand.test"], token: TOKEN, quoteId: "quote" })).not.toThrow();
  });
  it("assertProposalContentMarkers needs both an identity and a plan marker", () => {
    expect(() => assertProposalContentMarkers(PAGE_HTML, MARKERS, "quote")).not.toThrow();
    expect(() => assertProposalContentMarkers(PAGE_HTML, { identity: ["Example LLC"], plan: ["Grow"] }, "quote")).toThrow("quote quote");
    expect(() => assertProposalContentMarkers(PAGE_HTML, { identity: ["Nobody"], plan: ["Maintain"] }, "quote")).toThrow("quote quote");
    expect(() => assertProposalContentMarkers(PAGE_HTML, { identity: [], plan: ["Maintain"] }, "quote")).toThrow("quote quote");
  });
});

describe("same-origin asset embedding", () => {
  const pngBytes = new Uint8Array(1000).fill(7);
  it("embeds a small same-origin image as a data URI within caps", async () => {
    const html = PAGE_HTML.replace(
      '<img src="https://cdn.test/logo.png" alt="Firm logo">',
      '<img src="/logo.png" alt="Firm logo">',
    );
    const copy = await buildValidated(html, VALID_URL, { "/logo.png": { mime: "image/png", bytes: pngBytes } });
    expect(copy.assetsInlined.images).toBe(1);
    expect(decodeAcceptedCopyHtml(copy)).toContain("data:image/png;base64,");
  });
  it("leaves an oversized same-origin image as a placeholder", async () => {
    const html = PAGE_HTML.replace(
      '<img src="https://cdn.test/logo.png" alt="Firm logo">',
      '<img src="https://brand.test/big.png" alt="Big logo">',
    );
    const copy = await buildValidated(html, VALID_URL,
      { "/big.png": { mime: "image/png", bytes: new Uint8Array(300_000).fill(9) } });
    expect(copy.assetsInlined.images).toBe(0);
    expect(copy.assetsInlined.skipped).toBeGreaterThanOrEqual(1);
    expect(decodeAcceptedCopyHtml(copy)).toContain("[Big logo]");
  });
  it("leaves cross-origin images as placeholders", async () => {
    const copy = await buildValidated(PAGE_HTML, VALID_URL);
    expect(copy.assetsInlined.images).toBe(0);
    expect(decodeAcceptedCopyHtml(copy)).toContain("[Tracker]");
    expect(decodeAcceptedCopyHtml(copy)).toContain("[Firm logo]");
  });
  it("embeds a same-origin font referenced by the inlined CSS", async () => {
    const html = PAGE_HTML.replace(
      '<link rel="stylesheet" href="/_next/static/css/app.abc123.css">',
      '<link rel="stylesheet" href="/_next/static/css/app.fonts.css">',
    );
    const css = `@font-face{font-family:Body;src:url(https://brand.test/fonts/body.woff2)}.plan{color:red}`;
    const fetchImpl = stubFetch(
      { "/proposal/": { url: VALID_URL, html }, "/app.fonts.css": { url: "https://brand.test/_next/static/css/app.fonts.css", html: css } },
      { "/fonts/body.woff2": { mime: "font/woff2", bytes: new Uint8Array(2000).fill(3) } },
    );
    const copy = await fetchAndBuildAcceptedCopy({
      origin: "https://brand.test", token: TOKEN, quoteId: "quote", source: "backfill",
      selection: selection as unknown as Record<string, unknown>, fetchImpl,
      allowedHosts: ["brand.test"], expectedMarkers: MARKERS, savedAt: signedAt,
    });
    expect(copy.assetsInlined.fonts).toBe(1);
    expect(copy.cssInlined).toBe(true);
    expect(decodeAcceptedCopyHtml(copy)).toContain("data:font/woff2;base64,");
  });
  it("drops cross-origin font references to the system fallback", async () => {
    const copy = await buildValidated(PAGE_HTML, VALID_URL);
    expect(copy.assetsInlined.fonts).toBe(0);
    const decoded = decodeAcceptedCopyHtml(copy);
    expect(decoded).not.toContain("data:font/");
    expect(decoded).toContain(".plan{color:red");
  });
});

describe("HTML-escaped markers", () => {
  // Realistic React-escaped rendering: & -> &amp;, ' -> &#x27;, " -> &quot;,
  // < -> &lt;, > -> &gt;. Raw quote data must match this escaped output.
  const escapedPage = (identity: string, plan: string) => `<!doctype html><html><head></head><body><main>`
    + `<h1>Your bookkeeping plan</h1><p>Prepared for ${identity}</p><p>${plan} plan — Essentials Momentum Advisory $321.09</p>`
    + `</main></body></html>`;
  it("decodes named and numeric entities", () => {
    expect(decodeMarkerEntities("Smith &amp; Sons")).toBe("Smith & Sons");
    expect(decodeMarkerEntities("O&#x27;Brien")).toBe("O'Brien");
    expect(decodeMarkerEntities("O&#39;Brien")).toBe("O'Brien");
    expect(decodeMarkerEntities("O&apos;Brien")).toBe("O'Brien");
    expect(decodeMarkerEntities("&quot;Quoted&quot;")).toBe('"Quoted"');
    expect(decodeMarkerEntities("A&lt;B&gt;C")).toBe("A<B>C");
    expect(decodeMarkerEntities("Maintain &amp; Grow")).toBe("Maintain & Grow");
    expect(decodeMarkerEntities("plain")).toBe("plain");
  });
  it("matches Smith & Sons against a realistic escaped page", () => {
    expect(() => assertProposalContentMarkers(
      escapedPage("Smith &amp; Sons", "Maintain"), { identity: ["Smith & Sons"], plan: ["Maintain"] }, "quote",
    )).not.toThrow();
  });
  it("matches O'Brien (hex, decimal and named escapes) against realistic pages", () => {
    for (const rendered of ["O&#x27;Brien", "O&#39;Brien", "O&apos;Brien"]) {
      expect(() => assertProposalContentMarkers(
        escapedPage(rendered, "Maintain"), { identity: ["O'Brien"], plan: ["Maintain"] }, "quote",
      )).not.toThrow();
    }
  });
  it("matches Maintain & Grow and names containing angle brackets", () => {
    expect(() => assertProposalContentMarkers(
      escapedPage("Example LLC", "Maintain &amp; Grow"), { identity: ["Example LLC"], plan: ["Maintain & Grow"] }, "quote",
    )).not.toThrow();
    expect(() => assertProposalContentMarkers(
      escapedPage("A&lt;B Corp", "Maintain"), { identity: ["A<B Corp"], plan: ["Maintain"] }, "quote",
    )).not.toThrow();
  });
  it("matches across collapsed markup whitespace", () => {
    const spaced = `<!doctype html><html><body><main><p>Prepared for Smith\n   &amp;\n Sons</p><p>Maintain\n plan</p></main></body></html>`;
    expect(() => assertProposalContentMarkers(
      spaced, { identity: ["Smith & Sons"], plan: ["Maintain plan"] }, "quote",
    )).not.toThrow();
  });
  it("still fails closed when the escaped page lacks a marker", () => {
    expect(() => assertProposalContentMarkers(
      escapedPage("Smith &amp; Sons", "Maintain"), { identity: ["Nobody"], plan: ["Maintain"] }, "quote",
    )).toThrow("quote quote");
    expect(() => assertProposalContentMarkers(
      escapedPage("Smith &amp; Sons", "Maintain"), { identity: ["Smith & Sons"], plan: ["Grow"] }, "quote",
    )).toThrow("quote quote");
  });
  it("stores a copy for an escaped-name quote end to end", async () => {
    const html = escapedPage("Smith &amp; Sons", "Maintain &amp; Grow");
    const pages: Record<string, { url: string; html: string }> = {
      "/proposal/": { url: VALID_URL, html },
    };
    const copy = await fetchAndBuildAcceptedCopy({
      origin: "https://brand.test", token: TOKEN, quoteId: "quote", source: "backfill",
      selection: selection as unknown as Record<string, unknown>,
      fetchImpl: stubFetch(pages),
      allowedHosts: ["brand.test"],
      expectedMarkers: { identity: ["Smith & Sons"], plan: ["Maintain & Grow"] },
      savedAt: signedAt,
    });
    expect(decodeAcceptedCopyHtml(copy)).toContain("Smith &amp; Sons");
    expect(readAcceptedCopy({ acceptedProposalCopy: copy })).toEqual(copy);
  });
});

describe("copy failure visibility", () => {
  it("reads the staff-visible last-error record", () => {
    expect(readAcceptedCopyLastError({ acceptedProposalCopyLastError: { at: "2026-11-27T00:00:00Z", reason: "fetch-failed" } }))
      .toEqual({ at: "2026-11-27T00:00:00Z", reason: "fetch-failed" });
    expect(readAcceptedCopyLastError({})).toBeNull();
    expect(readAcceptedCopyLastError({ acceptedProposalCopyLastError: { at: "x", reason: "bogus" } })).toBeNull();
    expect(readAcceptedCopyLastError(null)).toBeNull();
  });
  it("maps failures to reason codes, defaulting to fetch-failed", () => {
    expect(acceptedCopyErrorReason(new Error("Brand b has no verified proposal host."))).toBe("no-verified-domain");
    const tagged = new Error("Accepted copy fetch failed for quote q.");
    (tagged as Error & { copyReason?: string }).copyReason = "validation-failed";
    expect(acceptedCopyErrorReason(tagged)).toBe("validation-failed");
    expect(acceptedCopyErrorReason(new Error("connect timeout"))).toBe("fetch-failed");
  });
  it("records validation-failed when the fetched page lacks the quote markers", async () => {
    const bad = (async () => new Response(
      `<!doctype html><html><body><main><div>Something else</div></main></body></html>`,
      { status: 200, headers: { "content-type": "text/html" } },
    )) as typeof fetch;
    await expect(saveAcceptedCopy({ brandId: "brand", quoteId: "quote", source: "backfill", fetchImpl: bad }))
      .rejects.toThrow("quote quote");
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    const [sql, json, id, brandId] = mocks.patch.mock.calls[0];
    expect(sql.join("?")).toContain("'{acceptedProposalCopyLastError}'");
    expect(sql.join("?")).not.toContain("'{acceptedProposalCopy}'");
    expect(sql.join("?")).not.toMatch(/updatedAt|SET.*status/);
    expect(JSON.parse(json)).toMatchObject({ reason: "validation-failed" });
    expect(String(JSON.parse(json).at)).not.toHaveLength(0);
    expect(JSON.stringify(JSON.parse(json))).not.toContain(TOKEN);
    expect([id, brandId]).toEqual(["eng", "brand"]);
  });
  it("records fetch-failed on a throwing fetch without leaking the token", async () => {
    const bad = (async () => { throw new Error("connect timeout"); }) as typeof fetch;
    await expect(saveAcceptedCopy({ brandId: "brand", quoteId: "quote", source: "backfill", fetchImpl: bad }))
      .rejects.toThrow("quote quote");
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    const [, json] = mocks.patch.mock.calls[0];
    expect(JSON.parse(json)).toMatchObject({ reason: "fetch-failed" });
    expect(JSON.stringify(mocks.patch.mock.calls)).not.toContain(TOKEN);
  });
  it("a successful save clears a previous error key in the same atomic patch", async () => {
    mocks.quote.mockResolvedValue({
      ...row(),
      engagement: { ...row().engagement, onboardingData: {
        ...row().engagement.onboardingData,
        acceptedProposalCopyLastError: { at: "2026-11-01T00:00:00Z", reason: "fetch-failed" },
      } },
    });
    const { fetchImpl } = fetchHarness();
    await saveAcceptedCopy({ brandId: "brand", quoteId: "quote", source: "backfill", fetchImpl });
    expect(mocks.patch).toHaveBeenCalledTimes(1);
    const [sql, json] = mocks.patch.mock.calls[0];
    expect(sql.join("?")).toContain("'{acceptedProposalCopy}'");
    expect(sql.join("?")).toContain("- 'acceptedProposalCopyLastError'");
    expect(sql.join("?")).not.toMatch(/updatedAt|SET.*status/);
    expect(JSON.parse(json)).toMatchObject({ version: 2, quoteId: "quote" });
  });
});


