import {
  BrandRole,
  BrandStatus,
  MembershipStatus,
  PlatformRole,
  UserStatus,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import { authorizeBrandAccess, selectCurrentBrand, selectInitialBrand } from "./access";

const activeMember = {
  role: BrandRole.MEMBER,
  status: MembershipStatus.ACTIVE,
};

describe("authorizeBrandAccess", () => {
  it("allows an active membership on an active brand", () => {
    expect(
      authorizeBrandAccess({
        userStatus: UserStatus.ACTIVE,
        platformRole: PlatformRole.NONE,
        brandStatus: BrandStatus.ACTIVE,
        membership: activeMember,
      }),
    ).toEqual({ allowed: true, via: "BRAND_MEMBERSHIP" });
  });

  it("denies a user with no membership", () => {
    expect(
      authorizeBrandAccess({
        userStatus: UserStatus.ACTIVE,
        platformRole: PlatformRole.NONE,
        brandStatus: BrandStatus.ACTIVE,
        membership: null,
      }),
    ).toEqual({ allowed: false, reason: "MEMBERSHIP_NOT_ACTIVE" });
  });

  it("denies an invited or suspended membership", () => {
    for (const status of [MembershipStatus.INVITED, MembershipStatus.SUSPENDED]) {
      expect(
        authorizeBrandAccess({
          userStatus: UserStatus.ACTIVE,
          platformRole: PlatformRole.NONE,
          brandStatus: BrandStatus.ACTIVE,
          membership: { role: BrandRole.OWNER, status },
        }),
      ).toEqual({ allowed: false, reason: "MEMBERSHIP_NOT_ACTIVE" });
    }
  });

  it("enforces the minimum brand role", () => {
    expect(
      authorizeBrandAccess({
        userStatus: UserStatus.ACTIVE,
        platformRole: PlatformRole.NONE,
        brandStatus: BrandStatus.ACTIVE,
        membership: activeMember,
        minimumRole: BrandRole.ADMIN,
      }),
    ).toEqual({ allowed: false, reason: "INSUFFICIENT_BRAND_ROLE" });
  });

  it("allows platform administrators to manage non-active brands", () => {
    for (const brandStatus of [BrandStatus.DRAFT, BrandStatus.SUSPENDED, BrandStatus.OFFBOARDING]) {
      expect(
        authorizeBrandAccess({
          userStatus: UserStatus.ACTIVE,
          platformRole: PlatformRole.ADMIN,
          brandStatus,
          membership: null,
        }),
      ).toEqual({ allowed: true, via: "PLATFORM_ROLE" });
    }
  });

  it("never grants access to a deleted brand", () => {
    expect(
      authorizeBrandAccess({
        userStatus: UserStatus.ACTIVE,
        platformRole: PlatformRole.OWNER,
        brandStatus: BrandStatus.DELETED,
        membership: null,
      }),
    ).toEqual({ allowed: false, reason: "BRAND_DELETED" });
  });

  it("does not let a platform role bypass user suspension", () => {
    expect(
      authorizeBrandAccess({
        userStatus: UserStatus.SUSPENDED,
        platformRole: PlatformRole.OWNER,
        brandStatus: BrandStatus.ACTIVE,
        membership: null,
      }),
    ).toEqual({ allowed: false, reason: "USER_NOT_ACTIVE" });
  });
});

describe("selectInitialBrand", () => {
  it("prefers an accessible entry-host brand", () => {
    expect(
      selectInitialBrand({
        accessibleBrandIds: ["contigo", "melbourne"],
        entryBrandId: "melbourne",
        lastActiveBrandId: "contigo",
      }),
    ).toBe("melbourne");
  });

  it("starts on Southwest Digital when that owner also belongs to Bookkeeping Conroe", () => {
    expect(
      selectInitialBrand({
        accessibleBrandIds: ["southwest-digital", "bookkeeping-conroe"],
        entryBrandId: "southwest-digital",
      }),
    ).toBe("southwest-digital");
  });

  it("does not select an unauthorized entry-host brand", () => {
    expect(
      selectInitialBrand({
        accessibleBrandIds: ["contigo", "melbourne"],
        entryBrandId: "bookkeeping-conroe",
      }),
    ).toBeNull();
  });

  it("uses an accessible remembered brand when no entry brand applies", () => {
    expect(
      selectInitialBrand({
        accessibleBrandIds: ["contigo", "melbourne"],
        lastActiveBrandId: "contigo",
      }),
    ).toBe("contigo");
  });

  it("selects the only accessible brand", () => {
    expect(selectInitialBrand({ accessibleBrandIds: ["bookkeeping-conroe"] })).toBe(
      "bookkeeping-conroe",
    );
  });

  it("requires an explicit choice when multiple brands remain", () => {
    expect(selectInitialBrand({ accessibleBrandIds: ["contigo", "melbourne"] })).toBeNull();
  });
});

describe("selectCurrentBrand", () => {
  it("keeps an accessible brand selected after the user switches", () => {
    expect(
      selectCurrentBrand({
        accessibleBrandIds: ["contigo", "melbourne"],
        activeBrandId: "melbourne",
        entryBrandId: "contigo",
      }),
    ).toBe("melbourne");
  });

  it("rejects a tampered active-brand cookie", () => {
    expect(
      selectCurrentBrand({
        accessibleBrandIds: ["contigo"],
        activeBrandId: "bookkeeping-conroe",
        entryBrandId: "contigo",
      }),
    ).toBe("contigo");
  });
});

