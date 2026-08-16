import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Email from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PlatformRole, UserStatus } from "@prisma/client";
import { inspect } from "node:util";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";

const googleConfigured =
  Boolean(process.env.AUTH_GOOGLE_ID) && Boolean(process.env.AUTH_GOOGLE_SECRET);

const rawEmailServer = process.env.AUTH_EMAIL_SERVER?.trim() ?? "";
const emailServerValid = (() => {
  if (!rawEmailServer) return false;
  if (rawEmailServer.startsWith("{")) return true;
  try {
    return Boolean(new URL(rawEmailServer).hostname);
  } catch {
    return false;
  }
})();
const emailConfigured = emailServerValid && Boolean(process.env.AUTH_EMAIL_FROM?.trim());

const devBypassConfigured = process.env.NODE_ENV === "development";

export const providerIds = {
  google: googleConfigured,
  email: emailConfigured,
  devBypass: devBypassConfigured,
};

const providers = [
  googleConfigured
    ? Google({
        clientId: process.env.AUTH_GOOGLE_ID as string,
        clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
        allowDangerousEmailAccountLinking: true,
        authorization: { params: { prompt: "select_account" } },
      })
    : null,
  emailConfigured
    ? Email({
        server: rawEmailServer,
        from: process.env.AUTH_EMAIL_FROM as string,
      })
    : null,
  devBypassConfigured
    ? Credentials({
        id: "dev-bypass",
        name: "Dev Bypass",
        credentials: { email: { label: "Email", type: "email" } },
        async authorize(credentials) {
          if (process.env.NODE_ENV !== "development") return null;
          const email =
            typeof credentials?.email === "string"
              ? credentials.email.trim().toLowerCase()
              : "";
          if (!email) return null;

          const selectFields = {
            id: true,
            name: true,
            email: true,
            platformRole: true,
            status: true,
          } as const;

          let user = await prisma.user
            .findUnique({ where: { email }, select: selectFields })
            .catch(async (err) => {
              console.warn("[dev-bypass] DB error, retrying in 2s...", err.message);
              await new Promise((r) => setTimeout(r, 2000));
              return prisma.user.findUnique({ where: { email }, select: selectFields });
            });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: email.split("@")[0],
                platformRole: PlatformRole.OWNER,
                status: UserStatus.ACTIVE,
              },
              select: selectFields,
            });
          }

          if (user.status !== UserStatus.ACTIVE) {
            console.error("[dev-bypass] User is not ACTIVE:", email);
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            platformRole: user.platformRole,
            status: user.status,
          };
        },
      })
    : null,
].filter((p): p is NonNullable<typeof p> => p !== null);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  logger: {
    error(code, ...message) {
      console.error(
        "[next-auth][error]",
        inspect(code, { depth: 8, colors: false }),
        ...message.map((e) => inspect(e, { depth: 8, colors: false })),
      );
      const cause = (code as { cause?: unknown }).cause;
      if (cause) console.error("[next-auth][error][cause]", inspect(cause, { depth: 8, colors: false }));
    },
    warn(code, ...message) {
      console.warn(
        "[next-auth][warn]",
        inspect(code, { depth: 8, colors: false }),
        ...message.map((e) => inspect(e, { depth: 8, colors: false })),
      );
    },
  },
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      const knownUser = user as { status?: UserStatus };
      if (knownUser.status !== undefined) {
        return knownUser.status === UserStatus.ACTIVE;
      }
      if (!user.email) return false;
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { status: true },
      });
      if (!dbUser) {
        return account?.provider === "google" || account?.provider === "email";
      }
      return dbUser.status === UserStatus.ACTIVE;
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; platformRole?: PlatformRole; status?: UserStatus };
        if (u.id && u.platformRole && u.status !== undefined) {
          token.sub = u.id;
          token.platformRole = u.platformRole;
          token.status = u.status;
          return token;
        }
      }

      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, platformRole: true, status: true },
        });
        if (dbUser) {
          token.sub = dbUser.id;
          token.platformRole = dbUser.platformRole;
          token.status = dbUser.status;
          return token;
        }
      }

      token.platformRole = (token.platformRole as PlatformRole | undefined) ?? PlatformRole.NONE;
      token.status = (token.status as UserStatus | undefined) ?? UserStatus.INVITED;
      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.sub) return session;
      session.user.id = token.sub;
      session.user.platformRole = (token.platformRole as PlatformRole | undefined) ?? PlatformRole.NONE;
      session.user.status = (token.status as UserStatus | undefined) ?? UserStatus.INVITED;
      return session;
    },
  },
});
