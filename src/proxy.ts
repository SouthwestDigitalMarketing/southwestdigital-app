import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { NextResponse } from "next/server";
import { normalizeHostname } from "@/lib/brands/hostname";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/login", "/privacy-policy", "/terms-of-service"]);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/r/");

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    }
    return Response.redirect(loginUrl);
  }

  if (req.auth && pathname === "/login") {
    return Response.redirect(new URL("/dashboard", req.url));
  }

  const raw = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const hostname = normalizeHostname(raw);
  if (hostname) {
    const headers = new Headers(req.headers);
    headers.set("x-hostname", hostname);
    return NextResponse.next({ request: { headers } });
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
