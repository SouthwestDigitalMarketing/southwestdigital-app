import { PlatformRole, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isSignInEligible } from "./eligibility";

describe("isSignInEligible", () => {
  it("allows a pre-invited brand member", () => {
    expect(
      isSignInEligible({
        userExists: true,
        userStatus: UserStatus.INVITED,
        platformRole: PlatformRole.NONE,
        eligibleMembershipCount: 1,
        isGoogleProvider: false,
      }),
    ).toBe(true);
  });

  it("allows a platform administrator without a brand membership", () => {
    expect(
      isSignInEligible({
        userExists: true,
        userStatus: UserStatus.ACTIVE,
        platformRole: PlatformRole.ADMIN,
        eligibleMembershipCount: 0,
        isGoogleProvider: true,
        isGoogleEmailVerified: true,
      }),
    ).toBe(true);
  });

  it.each([
    { name: "unknown user", userExists: false, userStatus: undefined, memberships: 0 },
    { name: "suspended user", userExists: true, userStatus: UserStatus.SUSPENDED, memberships: 1 },
    { name: "user without access", userExists: true, userStatus: UserStatus.ACTIVE, memberships: 0 },
  ])("denies $name", ({ userExists, userStatus, memberships }) => {
    expect(
      isSignInEligible({
        userExists,
        userStatus,
        platformRole: PlatformRole.NONE,
        eligibleMembershipCount: memberships,
        isGoogleProvider: false,
      }),
    ).toBe(false);
  });

  it("denies Google identities whose email is not verified", () => {
    expect(
      isSignInEligible({
        userExists: true,
        userStatus: UserStatus.ACTIVE,
        platformRole: PlatformRole.OWNER,
        eligibleMembershipCount: 1,
        isGoogleProvider: true,
        isGoogleEmailVerified: false,
      }),
    ).toBe(false);
  });

  it("allows Google identities when verified status is omitted", () => {
    expect(
      isSignInEligible({
        userExists: true,
        userStatus: UserStatus.ACTIVE,
        platformRole: PlatformRole.OWNER,
        eligibleMembershipCount: 1,
        isGoogleProvider: true,
      }),
    ).toBe(true);
  });
});

