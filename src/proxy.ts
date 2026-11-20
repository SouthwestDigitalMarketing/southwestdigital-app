import { type NextRequest, NextResponse } from "next/server";
import { normalizeHostname } from "@/lib/brands/hostname";

export default function proxy(req: NextRequest) {
  const raw = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const hostname = normalizeHostname(raw);
  if (!hostname) return NextResponse.next();

  const headers = new Headers(req.headers);
  headers.set("x-hostname", hostname);
  // The app lock sends a locked device back here after /unlock.
  headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
