import { PlatformRole, UserStatus } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      platformRole: PlatformRole;
      status: UserStatus;
    } & DefaultSession["user"];
  }

  interface User {
    platformRole?: PlatformRole;
    status?: UserStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    platformRole?: PlatformRole;
    status?: UserStatus;
  }
}
