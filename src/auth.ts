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

if (process.env.AUTH_URL || process.env.NEXTAUTH_URL) {
  throw new Error(
    "AUTH_URL and NEXTAUTH_URL must remain unset; this deployment serves multiple trusted hostnames",
  );
}

function usesSecureAuthCookies(): boolean {
  try {
    const platformUrl = new URL(process.env.PLATFORM_BASE_URL ?? "");
    if (platformUrl.protocol === "https:") return true;
    if (
      platformUrl.protocol === "http:" &&
      (platformUrl.hostname === "localhost" || platformUrl.hostname === "127.0.0.1")
    ) {
      return false;
    }
    throw new Error("PLATFORM_BASE_URL must use HTTPS outside local development");
  } catch {
    if (process.env.PLATFORM_BASE_URL) {
      throw new Error("PLATFORM_BASE_URL must be a valid HTTPS or local HTTP URL");
    }
    return process.env.NODE_ENV === "production";
  }
}

const secureAuthCookies = usesSecureAuthCookies();
const secureCookiePrefix = secureAuthCookies ? "__Secure-" : "";
const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: secureAuthCookies,
};

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

function isAllowedRedirectProtocol(destination: URL): boolean {
  if (secureAuthCookies) {
    return destination.protocol === "https:" && destination.port === "";
  }

  return destination.protocol === "http:" || destination.protocol === "https:";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  useSecureCookies: secureAuthCookies,
  cookies: {
    sessionToken: {
      name: `${secureCookiePrefix}swd-authjs.session-token`,
      options: authCookieOptions,
    },
    callbackUrl: {
      name: `${secureCookiePrefix}swd-authjs.callback-url`,
      options: authCookieOptions,
    },
    csrfToken: {
      name: `${secureAuthCookies ? "__Host-" : ""}swd-authjs.csrf-token`,
      options: authCookieOptions,
    },
    pkceCodeVerifier: {
      name: `${secureCookiePrefix}swd-authjs.pkce.code_verifier`,
      options: { ...authCookieOptions, maxAge: 15 * 60 },
    },
    state: {
      name: `${secureCookiePrefix}swd-authjs.state`,
      options: { ...authCookieOptions, maxAge: 15 * 60 },
    },
    nonce: {
      name: `${secureCookiePrefix}swd-authjs.nonce`,
      options: authCookieOptions,
    },
    webauthnChallenge: {
      name: `${secureCookiePrefix}swd-authjs.challenge`,
      options: { ...authCookieOptions, maxAge: 15 * 60 },
    },
  },
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
      if (
        isAllowedRedirectProtocol(destination) &&
        (await isAllowedRedirectHostname(destination.hostname))
      ) {
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
