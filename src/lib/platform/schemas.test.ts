import { BrandRole, DomainPurpose } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  addBrandDomainSchema,
  createBrandOnboardingSchema,
  inviteBrandMemberSchema,
} from "./schemas";

describe("platform administration input schemas", () => {
  it("normalizes a new brand hostname and owner email", () => {
    const input = createBrandOnboardingSchema.parse({
      name: "Melbourne CFO",
      slug: "melbourne-cfo",
      appHostname: "APP.MelbourneCFO.com.au.",
      ownerEmail: " Dagny@Example.COM ",
      primaryColor: "#243b5a",
      accentColor: "#d59a35",
      backgroundColor: "#f7f8fa",
      foregroundColor: "#17202a",
    });

    expect(input.appHostname).toBe("app.melbournecfo.com.au");
    expect(input.ownerEmail).toBe("dagny@example.com");
  });

  it("keeps newly entered domains pending by omitting status from the input", () => {
    const input = addBrandDomainSchema.parse({
      brandId: "brand-1",
      hostname: "app.contigoaccounting.com",
      purpose: DomainPurpose.APP,
    });

    expect(input).toEqual({
      brandId: "brand-1",
      hostname: "app.contigoaccounting.com",
      purpose: DomainPurpose.APP,
    });
    expect("status" in input).toBe(false);
  });

  it("rejects malformed slugs, colors, hostnames, emails, and roles", () => {
    expect(
      createBrandOnboardingSchema.safeParse({
        name: "Bad brand",
        slug: "Bad Brand",
        appHostname: "example.com/path",
        ownerEmail: "not-an-email",
        primaryColor: "blue",
        accentColor: "#d59a35",
        backgroundColor: "#f7f8fa",
        foregroundColor: "#17202a",
      }).success,
    ).toBe(false);

    expect(
      inviteBrandMemberSchema.safeParse({
        brandId: "brand-1",
        email: "member@example.com",
        role: "PLATFORM_ADMIN",
      }).success,
    ).toBe(false);

    expect(
      inviteBrandMemberSchema.parse({
        brandId: "brand-1",
        email: "member@example.com",
        role: BrandRole.MEMBER,
      }).role,
    ).toBe(BrandRole.MEMBER);
  });
});
