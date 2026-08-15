import "server-only";

import type { PlatformRole } from "@prisma/client";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isPlatformHostname } from "@/lib/brands/active-brand";
import { resolveAppBrandByHostname } from "@/lib/brands/repository";
import { effectiveRequestHostname } from "@/lib/brands/request";
import { isPlatformAdministrator } from "@/lib/platform/access";

export async function requireTrustedPortalHost(platformRole: PlatformRole) {
  const requestHeaders = await headers();
  const hostname = effectiveRequestHostname({
    requestHostname: requestHeaders.get("host"),
    developmentOverride: process.env.DEV_BRAND_HOST,
    nodeEnv: process.env.NODE_ENV,
  });

  if (isPlatformHostname(hostname, process.env.PLATFORM_BASE_URL)) {
    if (!isPlatformAdministrator(platformRole)) redirect("/access-denied");
    return { entryBrand: null, isPlatformEntry: true } as const;
  }

  const entryBrand = await resolveAppBrandByHostname(hostname);
  if (!entryBrand) notFound();

  return { entryBrand, isPlatformEntry: false } as const;
}
