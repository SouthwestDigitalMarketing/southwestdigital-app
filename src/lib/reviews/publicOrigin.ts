import "server-only";

import { BrandStatus, DomainPurpose, DomainStatus } from "@prisma/client";
import { isPlatformHostname } from "@/lib/brands/active-brand";
import { prisma } from "@/lib/prisma";

const MISSING_DOMAIN =
  "This brand has no verified app domain. Add and verify one before sending review requests.";
const PLATFORM_HOST = "The operator platform host cannot be used as a public review link.";

export async function resolvePublicReviewOrigin(brandId: string): Promise<string> {
  const domain = await prisma.brandDomain.findFirst({
    where: {
      brandId,
      purpose: DomainPurpose.APP,
      status: DomainStatus.VERIFIED,
      brand: { status: BrandStatus.ACTIVE },
    },
    orderBy: [{ isPrimary: "desc" }, { hostname: "asc" }],
    select: { hostname: true },
  });

  if (!domain) throw new Error(MISSING_DOMAIN);
  if (isPlatformHostname(domain.hostname, process.env.PLATFORM_BASE_URL)) {
    throw new Error(PLATFORM_HOST);
  }

  const local = domain.hostname === "localhost" || domain.hostname === "127.0.0.1";
  const useHttp = local && process.env.NODE_ENV !== "production";
  if (useHttp) {
    const port = process.env.PORT?.trim() || "3000";
    return `http://${domain.hostname}:${port}`;
  }
  return `https://${domain.hostname}`;
}
