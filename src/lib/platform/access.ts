import { PlatformRole } from "@prisma/client";

export function isPlatformAdministrator(role: PlatformRole): boolean {
  return role === PlatformRole.ADMIN || role === PlatformRole.OWNER;
}
