import "server-only";
import { UserStatus } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { selectCurrentBrand } from "@/lib/brands/access";
import { ACTIVE_BRAND_COOKIE } from "@/lib/brands/active-brand";
import { effectiveRequestHostname } from "@/lib/brands/request";
import { getAccessibleBrands, resolveAppBrandByHostname } from "@/lib/brands/repository";
import { createBrandDataContext } from "./context";

export async function requireActiveBrandContext() {
  const session = await auth();
  if (!session?.user || session.user.status !== UserStatus.ACTIVE) redirect("/login");

  const [headerStore, cookieStore, accessibleBrands] = await Promise.all([
    headers(),
    cookies(),
    getAccessibleBrands(session.user.id, session.user.platformRole),
  ]);
  const hostname = effectiveRequestHostname({
    requestHostname: headerStore.get("host"),
    developmentOverride: process.env.DEV_BRAND_HOST,
    nodeEnv: process.env.NODE_ENV,
  });
  const entryBrand = await resolveAppBrandByHostname(hostname);
  const activeBrandId = selectCurrentBrand({
    accessibleBrandIds: accessibleBrands.map(({ id }) => id),
    activeBrandId: cookieStore.get(ACTIVE_BRAND_COOKIE)?.value,
    entryBrandId: entryBrand?.id,
  });
  if (!activeBrandId) redirect("/select-brand");

  const activeBrand = accessibleBrands.find(({ id }) => id === activeBrandId);
  if (!activeBrand) redirect("/select-brand");

  return {
    session,
    activeBrand,
    accessibleBrands,
    dataContext: createBrandDataContext({
      brandId: activeBrand.id,
      actorUserId: session.user.id,
    }),
  };
}

