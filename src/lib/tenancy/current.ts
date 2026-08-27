import "server-only";
import { BrandRole, UserStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { selectCurrentBrand } from "@/lib/brands/access";
import { ACTIVE_BRAND_COOKIE } from "@/lib/brands/active-brand";
import { getAccessibleBrands, getBrandAccessDecision } from "@/lib/brands/repository";
import { isPlatformAdministrator } from "@/lib/platform/access";
import { createBrandDataContext } from "./context";
import { requireTrustedPortalHost } from "./request-host";

export async function requireActiveBrandContext(options?: { minimumRole?: BrandRole }) {
  const session = await auth();
  if (!session?.user || session.user.status !== UserStatus.ACTIVE) redirect("/login");

  const [cookieStore, membershipBrands, requestEntry] = await Promise.all([
    cookies(),
    getAccessibleBrands(session.user.id),
    requireTrustedPortalHost(session.user.platformRole),
  ]);

  const accessibleBrands = [...membershipBrands];
  if (
    isPlatformAdministrator(session.user.platformRole) &&
    requestEntry.entryBrand &&
    !accessibleBrands.some(({ id }) => id === requestEntry.entryBrand.id)
  ) {
    accessibleBrands.push(requestEntry.entryBrand);
  }

  const activeBrandId = selectCurrentBrand({
    accessibleBrandIds: accessibleBrands.map(({ id }) => id),
    activeBrandId: cookieStore.get(ACTIVE_BRAND_COOKIE)?.value,
    entryBrandId: requestEntry.entryBrand?.id,
  });
  if (!activeBrandId) redirect("/select-brand");

  const activeBrand = accessibleBrands.find(({ id }) => id === activeBrandId);
  if (!activeBrand) redirect("/select-brand");

  const decision = await getBrandAccessDecision({
    brandId: activeBrand.id,
    userId: session.user.id,
    userStatus: session.user.status,
    platformRole: session.user.platformRole,
    minimumRole: options?.minimumRole ?? BrandRole.MEMBER,
  });
  if (options?.minimumRole && !decision.allowed) redirect("/dashboard?error=Forbidden");

  return {
    session,
    activeBrand,
    accessibleBrands,
    canWrite: decision.allowed,
    dataContext: createBrandDataContext({
      brandId: activeBrand.id,
      actorUserId: session.user.id,
    }),
  };
}
