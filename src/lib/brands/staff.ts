import "server-only";

import { redirect } from "next/navigation";
import { BrandRole, MembershipStatus, PlatformRole } from "@prisma/client";
import { resolveBrandById } from "@/lib/brands/resolve";
import { requireActiveBrandContext } from "@/lib/tenancy/current";

export function isPlatformOperator(role: PlatformRole | undefined) {
  return role === PlatformRole.OWNER || role === PlatformRole.ADMIN;
}

const STAFF_ROLES: BrandRole[] = [BrandRole.OWNER, BrandRole.ADMIN, BrandRole.MEMBER];

async function loadActiveAppBrand() {
  const { session, activeBrand, accessibleBrands } = await requireActiveBrandContext();
  const resolved = await resolveBrandById(activeBrand.id, session.user.id);
  if (!resolved) redirect("/select-brand");

  const operator = isPlatformOperator(session.user.platformRole);
  const activeMembership = resolved.membership?.status === MembershipStatus.ACTIVE;
  if (!operator && !activeMembership) redirect("/login?error=AccessDenied");

  return {
    session,
    brand: resolved.brand,
    membership: resolved.membership,
    accessibleBrands,
    platformRole: session.user.platformRole,
    isPlatformOperator: operator,
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
