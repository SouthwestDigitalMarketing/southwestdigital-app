import "server-only";

import type { PlatformRole } from "@prisma/client";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isPlatformHostname } from "@/lib/brands/active-brand";
import { resolveAppBrandByHostname } from "@/lib/brands/repository";
import { effectiveRequestHostname } from "@/lib/brands/request";
import { isPlatformAdministrator } from "@/lib/platform/access";

export async function currentRequestHostname() {
  const requestHeaders = await headers();
  return effectiveRequestHostname({
    requestHostname: requestHeaders.get("x-hostname") ?? requestHeaders.get("host"),
    developmentOverride: process.env.DEV_BRAND_HOST,
    nodeEnv: process.env.NODE_ENV,
  });
}

export async function requireTrustedPortalHost(platformRole: PlatformRole) {
  const hostname = await currentRequestHostname();

  if (isPlatformHostname(hostname, process.env.PLATFORM_BASE_URL)) {
    if (!isPlatformAdministrator(platformRole)) redirect("/access-denied");
    return { entryBrand: null, isPlatformEntry: true } as const;
  }

  const entryBrand = await resolveAppBrandByHostname(hostname);
  if (!entryBrand) notFound();

  return { entryBrand, isPlatformEntry: false } as const;
}
