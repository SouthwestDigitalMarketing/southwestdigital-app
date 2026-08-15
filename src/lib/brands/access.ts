import {
  BrandRole,
  BrandStatus,
  MembershipStatus,
  PlatformRole,
  UserStatus,
} from "@prisma/client";

const BRAND_ROLE_RANK: Record<BrandRole, number> = {
  [BrandRole.VIEWER]: 0,
  [BrandRole.MEMBER]: 1,
  [BrandRole.ADMIN]: 2,
  [BrandRole.OWNER]: 3,
};

export type BrandAccessDenial =
  | "USER_NOT_ACTIVE"
  | "BRAND_DELETED"
  | "BRAND_NOT_ACTIVE"
  | "MEMBERSHIP_NOT_ACTIVE"
  | "INSUFFICIENT_BRAND_ROLE";

export type BrandAccessDecision =
  | { allowed: true; via: "PLATFORM_ROLE" | "BRAND_MEMBERSHIP" }
  | { allowed: false; reason: BrandAccessDenial };

type MembershipAccessInput = {
  role: BrandRole;
  status: MembershipStatus;
} | null;

export function authorizeBrandAccess(input: {
  userStatus: UserStatus;
  platformRole: PlatformRole;
  brandStatus: BrandStatus;
  membership: MembershipAccessInput;
  minimumRole?: BrandRole;
}): BrandAccessDecision {
  if (input.userStatus !== UserStatus.ACTIVE) {
    return { allowed: false, reason: "USER_NOT_ACTIVE" };
  }

  if (input.brandStatus === BrandStatus.DELETED) {
    return { allowed: false, reason: "BRAND_DELETED" };
  }

  if (input.platformRole === PlatformRole.ADMIN || input.platformRole === PlatformRole.OWNER) {
    return { allowed: true, via: "PLATFORM_ROLE" };
  }

  if (input.brandStatus !== BrandStatus.ACTIVE) {
    return { allowed: false, reason: "BRAND_NOT_ACTIVE" };
  }

  if (!input.membership || input.membership.status !== MembershipStatus.ACTIVE) {
    return { allowed: false, reason: "MEMBERSHIP_NOT_ACTIVE" };
  }

  const minimumRole = input.minimumRole ?? BrandRole.VIEWER;
  if (BRAND_ROLE_RANK[input.membership.role] < BRAND_ROLE_RANK[minimumRole]) {
    return { allowed: false, reason: "INSUFFICIENT_BRAND_ROLE" };
  }

  return { allowed: true, via: "BRAND_MEMBERSHIP" };
}

/**
 * Selects a brand only from IDs already proven accessible to the user.
 * A valid entry hostname takes precedence over remembered preference.
 */
export function selectInitialBrand(input: {
  accessibleBrandIds: readonly string[];
  entryBrandId?: string | null;
  lastActiveBrandId?: string | null;
}): string | null {
  const accessible = new Set(input.accessibleBrandIds);

  if (input.entryBrandId && accessible.has(input.entryBrandId)) {
    return input.entryBrandId;
  }

  if (input.lastActiveBrandId && accessible.has(input.lastActiveBrandId)) {
    return input.lastActiveBrandId;
  }

  return accessible.size === 1 ? accessible.values().next().value ?? null : null;
}

/** Uses an already-validated active choice before falling back to the entry host. */
export function selectCurrentBrand(input: {
  accessibleBrandIds: readonly string[];
  activeBrandId?: string | null;
  entryBrandId?: string | null;
}): string | null {
  const accessible = new Set(input.accessibleBrandIds);
  if (input.activeBrandId && accessible.has(input.activeBrandId)) return input.activeBrandId;
  if (input.entryBrandId && accessible.has(input.entryBrandId)) return input.entryBrandId;
  return accessible.size === 1 ? accessible.values().next().value ?? null : null;
}
