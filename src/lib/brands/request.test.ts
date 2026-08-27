import { describe, expect, it } from "vitest";
import { effectiveRequestHostname, safeRequestOrigin } from "./request";

describe("effectiveRequestHostname", () => {
  it("allows a local brand-host override only in development", () => {
    expect(
      effectiveRequestHostname({
        requestHostname: "localhost:3000",
        developmentOverride: "app.melbournecfo.com.au",
        nodeEnv: "development",
      }),
    ).toBe("app.melbournecfo.com.au");

    expect(
      effectiveRequestHostname({
        requestHostname: "app.contigoaccounting.com",
        developmentOverride: "app.melbournecfo.com.au",
        nodeEnv: "production",
      }),
    ).toBe("app.contigoaccounting.com");
  });

  it("extracts the hostname from a URL-shaped development override", () => {
    expect(
      effectiveRequestHostname({
        requestHostname: "localhost:3000",
        developmentOverride: "https://app.bookkeepingconroe.com",
        nodeEnv: "development",
      }),
    ).toBe("app.bookkeepingconroe.com");
  });

  it("falls back to the request hostname when the development override is invalid", () => {
    expect(
      effectiveRequestHostname({
        requestHostname: "localhost:3000",
        developmentOverride: "not a hostname",
        nodeEnv: "development",
      }),
    ).toBe("localhost");
  });
});

describe("safeRequestOrigin", () => {
  it("retains a valid external hostname and trusted protocol", () => {
    expect(
      safeRequestOrigin({
        hostHeader: "app.contigoaccounting.com",
        forwardedProto: "https",
        fallbackOrigin: "http://internal:3000",
        nodeEnv: "production",
      }),
    ).toBe("https://app.contigoaccounting.com");
  });

  it("retains an explicit local port", () => {
    expect(
      safeRequestOrigin({
        hostHeader: "localhost:3471",
        forwardedProto: "http",
        fallbackOrigin: "http://127.0.0.1:3471",
      }),
    ).toBe("http://localhost:3471");
  });

  it("falls back for malformed or ambiguous host headers", () => {
    expect(
      safeRequestOrigin({
        hostHeader: "good.example,evil.example",
        forwardedProto: "https",
        fallbackOrigin: "https://app.southwestdigital.io",
      }),
    ).toBe("https://app.southwestdigital.io");
  });
});
