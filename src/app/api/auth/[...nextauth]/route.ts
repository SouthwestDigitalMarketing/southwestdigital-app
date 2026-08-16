import { handlers } from "@/auth";
import { NextRequest } from "next/server";

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
  return handlers.GET(withForwardedOrigin(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withForwardedOrigin(req));
}
