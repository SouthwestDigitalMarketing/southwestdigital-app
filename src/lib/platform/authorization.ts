import "server-only";

import { UserStatus } from "@prisma/client";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPlatformHostname } from "@/lib/brands/active-brand";
import { isPlatformAdministrator } from "./access";

export async function requirePlatformAdministrator() {
  const requestHeaders = await headers();
  if (!isPlatformHostname(requestHeaders.get("host"), process.env.PLATFORM_BASE_URL)) {
    notFound();
  }

  const session = await auth();

  if (!session?.user || session.user.status !== UserStatus.ACTIVE) {
    redirect("/login");
  }

  if (!isPlatformAdministrator(session.user.platformRole)) {
    redirect("/access-denied");
  }

  return { session };
}
