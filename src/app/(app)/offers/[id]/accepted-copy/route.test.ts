import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ staff: vi.fn(), quote: vi.fn() }));
vi.mock("@/lib/quotes/access", () => ({ requireQuoteStaffOrThrow: mocks.staff }));
vi.mock("@/lib/prisma", () => ({ prisma: { quote: { findFirst: mocks.quote } } }));
import { GET } from "./route";
const html = "<!doctype html><html><body>Saved proposal</body></html>";
const copy = { version: 2, encoding: "gzip+base64", quoteId: "quote", savedAt: "2026-11-27",
  html: gzipSync(Buffer.from(html, "utf8")).toString("base64"), sha256: createHash("sha256").update(html, "utf8").digest("hex") };
const call = (query = "") => GET(new Request(`https://example.test/offers/quote/accepted-copy${query}`), { params: Promise.resolve({ id: "quote" }) });
beforeEach(() => { vi.clearAllMocks(); mocks.staff.mockResolvedValue({ brand: { id: "brand" } }); mocks.quote.mockResolvedValue({ engagement: { brandId: "brand", onboardingData: { acceptedProposalCopy: copy } } }); });
describe("saved-copy retrieval", () => {
  it("returns decoded bytes without rendering the public proposal or recording a view", async () => {
    const response = await call(); expect(response.status).toBe(200); expect(await response.text()).toBe(html);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "quote", brandId: "brand" } }));
  });
  it("downloads the same decoded bytes", async () => { const response = await call("?download=1"); expect(response.headers.get("Content-Disposition")).toContain("attachment"); expect(await response.text()).toBe(html); });
  it("requires staff authentication", async () => {
    mocks.staff.mockRejectedValue(new Error("Unauthorized")); await expect(call()).rejects.toThrow("Unauthorized"); expect(mocks.quote).not.toHaveBeenCalled();
  });
  it("rejects another brand, altered stored HTML and a v1 copy", async () => {
    const tamperedHtml = "<!doctype html><html><body>Tampered proposal</body></html>";
    const tampered = { ...copy, html: gzipSync(Buffer.from(tamperedHtml, "utf8")).toString("base64") };
    mocks.quote.mockResolvedValueOnce({ engagement: { brandId: "other", onboardingData: { acceptedProposalCopy: copy } } }); expect((await call()).status).toBe(404);
    mocks.quote.mockResolvedValueOnce({ engagement: { brandId: "brand", onboardingData: { acceptedProposalCopy: tampered } } }); expect((await call()).status).toBe(404);
    mocks.quote.mockResolvedValueOnce({ engagement: { brandId: "brand", onboardingData: { acceptedProposalCopy: { version: 1, html, sha256: createHash("sha256").update(html).digest("hex") } } } }); expect((await call()).status).toBe(404);
  });
});
