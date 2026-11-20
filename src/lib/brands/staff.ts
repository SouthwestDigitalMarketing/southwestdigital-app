import "server-only";

import { redirect } from "next/navigation";
import { BrandRole, MembershipStatus, PlatformRole } from "@prisma/client";
import { resolveBrandById } from "@/lib/brands/resolve";
import { requireActiveBrandContext } from "@/lib/tenancy/current";
import { getAppLockState } from "@/lib/app-lock/server";

export function isPlatformOperator(role: PlatformRole | undefined) {
  return role === PlatformRole.OWNER || role === PlatformRole.ADMIN;
}

const STAFF_ROLES: BrandRole[] = [BrandRole.OWNER, BrandRole.ADMIN, BrandRole.MEMBER];

async function loadActiveAppBrand() {
  const { session, activeBrand, accessibleBrands, dataContext } = await requireActiveBrandContext();
  const resolved = await resolveBrandById(activeBrand.id, session.user.id);
  if (!resolved || resolved.brand.status !== "ACTIVE") redirect("/select-brand");

  const operator = isPlatformOperator(session.user.platformRole);
  const activeMembership = resolved.membership?.status === MembershipStatus.ACTIVE;
  if (!operator && !activeMembership) redirect("/login?error=AccessDenied");
  // requireActiveBrandContext already sent a locked device to /unlock.
  const appLock = await getAppLockState(session.user.id);

  return {
    session,
    brand: resolved.brand,
    membership: resolved.membership,
    accessibleBrands,
    /** Pass to `withBrandDataTransaction` for every query on a row-level-security table (Contact, Lead, ...). */
    dataContext,
    platformRole: session.user.platformRole,
    isPlatformOperator: operator,
    appLock,
  };
}

export async function requireAppBrand() {
  return loadActiveAppBrand();
}

export async function requireStaffBrand() {
  const ctx = await loadActiveAppBrand();
  const staffMembership =
    ctx.membership?.status === MembershipStatus.ACTIVE && STAFF_ROLES.includes(ctx.membership.role);
  if (!ctx.isPlatformOperator && !staffMembership) redirect("/dashboard");
  return ctx;
}

export async function requireStaffBrandOrThrow() {
  const ctx = await loadActiveAppBrand();
  const staffMembership =
    ctx.membership?.status === MembershipStatus.ACTIVE && STAFF_ROLES.includes(ctx.membership.role);
  if (!ctx.isPlatformOperator && !staffMembership) throw new Error("Unauthorized");
  return ctx;
}

export function canAdministerBrand(ctx: {
  isPlatformOperator: boolean;
  membership: { status: MembershipStatus; role: BrandRole } | null;
}) {
  return ctx.isPlatformOperator || (
    ctx.membership?.status === MembershipStatus.ACTIVE &&
    (ctx.membership.role === BrandRole.OWNER || ctx.membership.role === BrandRole.ADMIN)
  );
}

export async function requireAdminBrandOrThrow() {
  const ctx = await loadActiveAppBrand();
  if (!canAdministerBrand(ctx)) throw new Error("Unauthorized");
  return ctx;
}
