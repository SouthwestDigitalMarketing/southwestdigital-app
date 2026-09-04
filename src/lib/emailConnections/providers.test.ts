import { describe, expect, it } from "vitest";
import {
  DEFAULT_ZOHO_REGION,
  PROVIDER_INFO,
  PROVIDER_ORDER,
  ZOHO_REGIONS,
  ZOHO_REGION_ORDER,
  isProviderAvailable,
  parseZohoRegion,
} from "./providers";

describe("email provider config", () => {
  it("exposes Zoho as the only available provider today", () => {
    expect(isProviderAvailable("ZOHO")).toBe(true);
    expect(isProviderAvailable("GMAIL")).toBe(false);
    expect(isProviderAvailable("MICROSOFT")).toBe(false);
    expect(isProviderAvailable("SMTP")).toBe(false);
  });

  it("lists all four providers so Coming Soon cards render", () => {
    expect(PROVIDER_ORDER).toEqual(["ZOHO", "GMAIL", "MICROSOFT", "SMTP"]);
    for (const provider of PROVIDER_ORDER) {
      expect(PROVIDER_INFO[provider]).toBeTruthy();
      expect(PROVIDER_INFO[provider].label.length).toBeGreaterThan(0);
    }
  });

  it("keeps Gmail / Microsoft / SMTP labelled as coming-soon", () => {
    expect(PROVIDER_INFO.GMAIL.status).toBe("coming-soon");
    expect(PROVIDER_INFO.MICROSOFT.status).toBe("coming-soon");
    expect(PROVIDER_INFO.SMTP.status).toBe("coming-soon");
  });
});

describe("parseZohoRegion", () => {
  it("accepts known regions case-insensitively", () => {
    expect(parseZohoRegion("us")).toBe("US");
    expect(parseZohoRegion("EU")).toBe("EU");
    expect(parseZohoRegion("in")).toBe("IN");
    expect(parseZohoRegion("au")).toBe("AU");
  });

  it("rejects anything else", () => {
    expect(parseZohoRegion(null)).toBeNull();
    expect(parseZohoRegion("")).toBeNull();
    expect(parseZohoRegion("XX")).toBeNull();
    expect(parseZohoRegion(42)).toBeNull();
  });

  it("defaults are consistent with the region list", () => {
    expect(ZOHO_REGIONS[DEFAULT_ZOHO_REGION]).toBeTruthy();
    expect(ZOHO_REGION_ORDER).toContain(DEFAULT_ZOHO_REGION);
    for (const key of ZOHO_REGION_ORDER) {
      const region = ZOHO_REGIONS[key];
      expect(region.accountsHost).toMatch(/^accounts\.zoho\./);
      expect(region.mailApiHost).toMatch(/^mail\.zoho\./);
    }
  });
});
