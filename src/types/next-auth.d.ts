import { PlatformRole, UserStatus } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      status: UserStatus;
      platformRole: PlatformRole;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

