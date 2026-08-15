import { ACTIVE_BRAND_COOKIE } from "./active-brand";

export function activeBrandCookie(brandId: string) {
  return {
    name: ACTIVE_BRAND_COOKIE,
    value: brandId,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  };
}
