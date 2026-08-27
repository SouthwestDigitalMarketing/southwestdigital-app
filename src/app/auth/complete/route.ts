import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { auth } from "@/auth";
import { selectInitialBrand } from "@/lib/brands/access";
import { isPlatformHostname } from "@/lib/brands/active-brand";
import { activeBrandCookie } from "@/lib/brands/cookie";
import { effectiveRequestHostname, safeRequestOrigin } from "@/lib/brands/request";
import { getAccessibleBrands, resolveAppBrandByHostname } from "@/lib/brands/repository";
import { isPlatformAdministrator } from "@/lib/platform/access";

export async function GET(request: NextRequest) {
  const requestOrigin = safeRequestOrigin({
    hostHeader: request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    fallbackOrigin: request.nextUrl.origin,
    developmentOverride: process.env.DEV_BRAND_HOST,
    nodeEnv: process.env.NODE_ENV,
  });
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", requestOrigin));
  if (session.user.status !== UserStatus.ACTIVE) {
    return NextResponse.redirect(new URL("/login?error=AccessDenied", requestOrigin));
  }

  const hostname = effectiveRequestHostname({
    requestHostname: request.headers.get("host"),
    developmentOverride: process.env.DEV_BRAND_HOST,
    nodeEnv: process.env.NODE_ENV,
  });
  const isPlatformEntry = isPlatformHostname(hostname, process.env.PLATFORM_BASE_URL);
  if (isPlatformEntry) {
    const destination = isPlatformAdministrator(session.user.platformRole)
      ? "/platform/brands"
      : "/access-denied";
    return NextResponse.redirect(new URL(destination, requestOrigin));
  }

  const [entryBrand, accessibleBrands] = await Promise.all([
    resolveAppBrandByHostname(hostname),
    getAccessibleBrands(session.user.id),
  ]);
  if (!entryBrand) {
    return NextResponse.redirect(new URL("/login?error=InvalidHost", requestOrigin));
  }
  const selectedBrandId =
    selectInitialBrand({
      accessibleBrandIds: accessibleBrands.map(({ id }) => id),
      entryBrandId: entryBrand.id,
    }) ?? (isPlatformAdministrator(session.user.platformRole) ? entryBrand.id : null);

  if (!selectedBrandId) {
    const destination = accessibleBrands.length > 1 ? "/select-brand" : "/login?error=AccessDenied";
    return NextResponse.redirect(new URL(destination, requestOrigin));
  }

  const response = NextResponse.redirect(new URL("/dashboard", requestOrigin));
  response.cookies.set(activeBrandCookie(selectedBrandId));
  return response;
}
