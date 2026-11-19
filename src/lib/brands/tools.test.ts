import { describe, expect, it } from "vitest";
import { mergeToolLinks, parseToolUrl, visibleToolLinks } from "./tools";

describe("parseToolUrl", () => {
  it("returns null for empty", () => {
    expect(parseToolUrl("  ")).toBeNull();
  });

  it("accepts https URLs including hashes", () => {
    expect(parseToolUrl("https://mail.zoho.com/zm/#calendar/wk")).toBe(
      "https://mail.zoho.com/zm/#calendar/wk",
    );
  });

  it("rejects http, javascript, and credentialed URLs", () => {
    expect(() => parseToolUrl("http://app.qbo.intuit.com/app/login")).toThrow(/https/);
    expect(() => parseToolUrl("javascript:alert(1)")).toThrow(/https/);
    expect(() => parseToolUrl("https://user:pass@example.com")).toThrow(/username or password/);
  });

  it("rejects unparseable values", () => {
    expect(() => parseToolUrl("app.qbo.intuit.com")).toThrow(/full URL/);
  });
});

describe("mergeToolLinks", () => {
  it("fills missing keys from defaults", () => {
    const merged = mergeToolLinks([
      { key: "quickbooks", label: "Xero", url: "https://go.xero.com/", sortOrder: 0 },
    ]);
    expect(merged[0]).toMatchObject({ key: "quickbooks", label: "Xero", url: "https://go.xero.com/" });
    expect(merged.map((link) => link.key)).toEqual([
      "quickbooks",
      "double",
      "calendar",
      "mail",
      "skool",
      "website",
    ]);
    expect(merged[1].url).toBe("https://app.doublehq.com/");
  });

  it("hides empty URLs from the sidebar set", () => {
    const merged = mergeToolLinks([
      { key: "double", label: "Double", url: "", sortOrder: 1 },
    ]);
    expect(visibleToolLinks(merged).map((link) => link.key)).toEqual([
      "quickbooks",
      "calendar",
      "mail",
      "skool",
    ]);
  });
});

describe("website link", () => {
  it("defaults to the brand's own site and is hidden for brands without one", () => {
    const conroe = mergeToolLinks([], "bookkeeping-conroe");
    expect(conroe.find((link) => link.key === "website")?.url).toBe("https://www.bookkeepingconroe.com/");
    expect(visibleToolLinks(conroe).at(-1)?.key).toBe("website");
    expect(mergeToolLinks([], "southwest-digital-marketing").find((link) => link.key === "website")?.url).toBe(
      "https://southwestdigital.io/",
    );
    expect(mergeToolLinks([], "real-estate-bookkeeper").find((link) => link.key === "website")?.url).toBe(
      "https://realestatebookkeeper.com/",
    );
    expect(mergeToolLinks([], "contigo-accounting").find((link) => link.key === "website")?.url).toBe(
      "https://www.contigoaccounting.com/",
    );
    expect(visibleToolLinks(mergeToolLinks([], "melbourne-cfo")).map((link) => link.key)).not.toContain("website");
  });

  it("keeps a stored website URL over the default", () => {
    const merged = mergeToolLinks(
      [{ key: "website", label: "Site", url: "https://example.com/", sortOrder: 5 }],
      "bookkeeping-conroe",
    );
    expect(merged.find((link) => link.key === "website")).toMatchObject({ label: "Site", url: "https://example.com/" });
  });
});
