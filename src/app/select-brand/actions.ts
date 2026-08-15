"use server";

import { UserStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { activeBrandCookie } from "@/lib/brands/cookie";
import { getAccessibleBrands } from "@/lib/brands/repository";
import { requireTrustedPortalHost } from "@/lib/tenancy/request-host";

const brandIdSchema = z.string().trim().min(1).max(64);

export async function selectBrand(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.status !== UserStatus.ACTIVE) redirect("/login");

  const parsed = brandIdSchema.safeParse(formData.get("brandId"));
  if (!parsed.success) redirect("/select-brand?error=invalid");

  const [, accessibleBrands] = await Promise.all([
    requireTrustedPortalHost(session.user.platformRole),
    getAccessibleBrands(session.user.id, session.user.platformRole),
  ]);
  if (!accessibleBrands.some(({ id }) => id === parsed.data)) {
    redirect("/select-brand?error=denied");
  }

  (await cookies()).set(activeBrandCookie(parsed.data));
  redirect("/portal");
}
