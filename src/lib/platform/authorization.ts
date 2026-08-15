import "server-only";

import { UserStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isPlatformAdministrator } from "./access";

export async function requirePlatformAdministrator() {
  const session = await auth();

  if (!session?.user || session.user.status !== UserStatus.ACTIVE) {
    redirect("/login");
  }

  if (!isPlatformAdministrator(session.user.platformRole)) {
    redirect("/portal");
  }

  return { session };
}
