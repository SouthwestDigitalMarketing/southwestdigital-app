import "server-only";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { resolveBrand } from "@/lib/brands/resolve";
import { BrandRole, MembershipStatus, PlatformRole } from "@prisma/client";

export function isPlatformOperator(role: PlatformRole | undefined) {
  return role === PlatformRole.OWNER || role === PlatformRole.ADMIN;
}

const STAFF_ROLES: BrandRole[] = [BrandRole.OWNER, BrandRole.ADMIN, BrandRole.MEMBER];

export async function requireStaffBrand() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const headersList = await headers();
  const resolved = await resolveBrand(headersList.get("x-hostname"), session.user.id);
  if (!resolved?.membership || resolved.membership.status !== MembershipStatus.ACTIVE) {
    redirect("/dashboard");
  }
  if (!STAFF_ROLES.includes(resolved.membership.role)) {
    redirect("/dashboard");
  }

  return {
    session,
    brand: resolved.brand,
    membership: resolved.membership,
    platformRole: session.user.platformRole,
    isPlatformOperator: isPlatformOperator(session.user.platformRole),
  };
}

export async function requireStaffBrandOrThrow() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const headersList = await headers();
  const resolved = await resolveBrand(headersList.get("x-hostname"), session.user.id);
  if (!resolved?.membership || resolved.membership.status !== MembershipStatus.ACTIVE) {
    throw new Error("Unauthorized");
  }
  if (!STAFF_ROLES.includes(resolved.membership.role)) {
    throw new Error("Unauthorized");
  }

  return {
    session,
    brand: resolved.brand,
    membership: resolved.membership,
    platformRole: session.user.platformRole,
    isPlatformOperator: isPlatformOperator(session.user.platformRole),
  };
}
