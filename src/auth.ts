import NextAuth, { type NextAuthConfig } from "next-auth";
import Google, { type GoogleProfile } from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { MembershipStatus, PlatformRole, UserStatus } from "@prisma/client";
import { isPlatformHostname } from "@/lib/brands/active-brand";
import { resolveAppBrandByHostname } from "@/lib/brands/repository";
import { normalizeEmail } from "@/lib/email/normalize";
import { BrandedResend } from "@/lib/auth/branded-resend";
import { isSignInEligible } from "@/lib/auth/eligibility";
import { prisma } from "@/lib/prisma";

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const emailConfigured = Boolean(process.env.AUTH_RESEND_KEY && process.env.AUTH_EMAIL_FROM);

export const authProviderAvailability = {
  google: googleConfigured,
  email: emailConfigured,
};

const providers: NextAuthConfig["providers"] = [];

if (googleConfigured) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL || undefined,
      authorization: { params: { prompt: "select_account" } },
      profile(profile: GoogleProfile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: normalizeEmail(profile.email),
          image: profile.picture,
        };
      },
    }),
  );
}

if (emailConfigured) {
  providers.push(
    BrandedResend({
      apiKey: process.env.AUTH_RESEND_KEY as string,
      from: process.env.AUTH_EMAIL_FROM as string,
    }),
  );
}

async function isAllowedRedirectHostname(hostname: string): Promise<boolean> {
  if (isPlatformHostname(hostname, process.env.PLATFORM_BASE_URL)) return true;
  return Boolean(await resolveAppBrandByHostname(hostname));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers,
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;
      const googleProfile = profile as GoogleProfile | undefined;

      const email = normalizeEmail(user.email);
      const invitedUser = await prisma.user.findUnique({
        where: { email },
        select: {
          status: true,
          platformRole: true,
          memberships: {
            where: { status: { in: [MembershipStatus.INVITED, MembershipStatus.ACTIVE] } },
            select: { id: true },
            take: 1,
          },
        },
      });

      return isSignInEligible({
        userExists: Boolean(invitedUser),
        userStatus: invitedUser?.status,
        platformRole: invitedUser?.platformRole,
        eligibleMembershipCount: invitedUser?.memberships.length ?? 0,
        isGoogleProvider: account?.provider === "google",
        isGoogleEmailVerified: googleProfile?.email_verified,
      });
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.status = (user as typeof user & { status: UserStatus }).status;
      session.user.platformRole = (user as typeof user & { platformRole: PlatformRole }).platformRole;
      return session;
    },
    async redirect({ url, baseUrl }) {
      const destination = new URL(url, baseUrl);
      if (await isAllowedRedirectHostname(destination.hostname)) {
        return destination.toString();
      }
      return process.env.PLATFORM_BASE_URL ?? baseUrl;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.email) return;
      const email = normalizeEmail(user.email);
      await prisma.$transaction([
        prisma.user.update({
          where: { email },
          data: { status: UserStatus.ACTIVE },
        }),
        prisma.brandMembership.updateMany({
          where: { user: { email }, status: MembershipStatus.INVITED },
          data: { status: MembershipStatus.ACTIVE },
        }),
      ]);
    },
  },
});
