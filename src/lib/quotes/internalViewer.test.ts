import { describe, expect, it } from "vitest";
import { hasInternalViewerCookie, internalViewerCookieValue } from "./internalViewer";

describe("internal viewer cookie", () => {
  it("detects the cookie among others", () => {
    expect(hasInternalViewerCookie("a=1; swapp_internal_viewer=1; b=2")).toBe(true);
    expect(hasInternalViewerCookie("swapp_internal_viewer=1")).toBe(true);
  });

  it("ignores absent or other values", () => {
    expect(hasInternalViewerCookie(null)).toBe(false);
    expect(hasInternalViewerCookie("")).toBe(false);
    expect(hasInternalViewerCookie("swapp_internal_viewer=0")).toBe(false);
    expect(hasInternalViewerCookie("xswapp_internal_viewer=1")).toBe(false);
  });

  it("sets a long-lived, site-wide cookie", () => {
    expect(internalViewerCookieValue()).toMatch(/^swapp_internal_viewer=1; Max-Age=\d+; Path=\/; SameSite=Lax; Secure$/);
  });
});
