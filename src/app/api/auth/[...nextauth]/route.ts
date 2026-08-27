import { handlers } from "@/auth";
import { NextRequest } from "next/server";
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

function withForwardedOrigin(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (!forwardedHost || !forwardedProto) return req;
  const url = new URL(req.url);
  const nextUrl = `${forwardedProto}://${forwardedHost}${url.pathname}${url.search}`;
  if (nextUrl === req.url) return req;
  return new NextRequest(nextUrl, req);
}

export async function GET(req: NextRequest) {
  if (!(await isTrustedAuthHost(req))) return new Response("Not Found", { status: 404 });
  return handlers.GET(withForwardedOrigin(req));
}

export async function POST(req: NextRequest) {
  if (!(await isTrustedAuthHost(req))) return new Response("Not Found", { status: 404 });
  return handlers.POST(withForwardedOrigin(req));
}
