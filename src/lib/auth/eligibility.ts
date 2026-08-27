import { PlatformRole, UserStatus } from "@prisma/client";

export function isSignInEligible(input: {
  userExists: boolean;
  userStatus?: UserStatus;
  platformRole?: PlatformRole;
  eligibleMembershipCount: number;
  isGoogleProvider: boolean;
  isGoogleEmailVerified?: boolean;
}): boolean {
  if (input.isGoogleProvider && input.isGoogleEmailVerified === false) return false;
  if (
    !input.userExists ||
    (input.userStatus !== UserStatus.INVITED && input.userStatus !== UserStatus.ACTIVE)
  ) {
    return false;
  }
  return input.platformRole !== PlatformRole.NONE || input.eligibleMembershipCount > 0;
}
