import "server-only";

import { resolveAppBrandByHostname } from "@/lib/brands/repository";
import { prisma } from "@/lib/prisma";

/** Signed OAuth state is necessary, but a retired domain is no longer a relay target. */
export async function isAuthorizedCallbackOrigin(origin: string, brandId: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin || url.username || url.password) return false;
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const localDevelopment = process.env.NODE_ENV !== "production" && local && url.protocol === "http:";
  if (url.protocol !== "https:" && !localDevelopment) return false;
  // A member can intentionally switch brands while remaining on an authorized
  // app host. State verification binds the operation to that active brand.
  const [activeBrand, entryBrand] = await Promise.all([
    prisma.brand.findFirst({ where: { id: brandId, status: "ACTIVE" }, select: { id: true } }),
    resolveAppBrandByHostname(url.hostname),
  ]);
  if (!activeBrand) return false;
  if (localDevelopment || entryBrand) return true;
  const configured = process.env.PLATFORM_BASE_URL;
  try {
    return Boolean(configured && origin === new URL(configured).origin);
  } catch {
    return false;
  }
}
