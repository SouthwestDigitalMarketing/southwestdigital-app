import { describe, expect, it } from "vitest";
import { isPlatformHostname, platformHostname } from "./active-brand";

describe("platform hostname", () => {
  it("extracts a normalized hostname from the platform URL", () => {
    expect(platformHostname("https://APP.SouthwestDigital.io/path")).toBe(
      "app.southwestdigital.io",
    );
  });

  it("matches only the configured platform hostname", () => {
    expect(isPlatformHostname("app.southwestdigital.io", "https://app.southwestdigital.io")).toBe(
      true,
    );
    expect(isPlatformHostname("evil.example", "https://app.southwestdigital.io")).toBe(false);
  });
});

