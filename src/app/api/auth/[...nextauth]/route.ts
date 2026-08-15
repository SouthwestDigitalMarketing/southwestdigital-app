import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { isPlatformHostname } from "@/lib/brands/active-brand";
import { resolveAppBrandByHostname } from "@/lib/brands/repository";
import { effectiveRequestHostname } from "@/lib/brands/request";

async function isTrustedAuthHost(request: NextRequest): Promise<boolean> {
  const hostname = effectiveRequestHostname({
    requestHostname: request.headers.get("host"),
    developmentOverride: process.env.DEV_BRAND_HOST,
    nodeEnv: process.env.NODE_ENV,
  });

  if (isPlatformHostname(hostname, process.env.PLATFORM_BASE_URL)) return true;
  return Boolean(await resolveAppBrandByHostname(hostname));
}

async function handleTrustedAuthRequest(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<Response>,
) {
  if (!(await isTrustedAuthHost(request))) {
    return new Response("Not Found", { status: 404 });
  }
  return handler(request);
}

export function GET(request: NextRequest) {
  return handleTrustedAuthRequest(request, handlers.GET);
}

export function POST(request: NextRequest) {
  return handleTrustedAuthRequest(request, handlers.POST);
}
