import { redirect } from "next/navigation";
import { auth, providerIds, signIn } from "@/auth";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PlatformRole, UserStatus } from "@prisma/client";
import { GoogleSignInButton } from "./GoogleSignInButton";

type SearchParams = Promise<{ callbackUrl?: string; error?: string }>;

const ERROR_MESSAGES: Record<string, string> = {
  DevBypassUserNotActive:
    "Dev login failed. Check the terminal for the real cause. If user is missing, run: node scripts/activateSuperAdmin.cjs",
  AccessDenied: "Your account is not authorized for this app.",
  EmailNotRegistered: "This email isn't registered. Ask an admin to add you.",
  EmailProviderNotConfigured: "Email magic link is not configured on this server.",
  ServerConfiguration: "Authentication is misconfigured. Verify auth environment variables.",
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/";

  if (session?.user?.id && session.user.status === UserStatus.ACTIVE) {
    redirect(callbackUrl);
  }

  const devUsers =
    process.env.NODE_ENV === "development"
      ? await prisma.user.findMany({
          where: { status: UserStatus.ACTIVE },
          select: { id: true, name: true, email: true, platformRole: true },
          orderBy: { name: "asc" },
        })
      : [];

  async function handleSignIn(formData: FormData) {
    "use server";
    const email = formData.get("email");
    if (typeof email !== "string" || !email.trim()) {
      redirect(`/login?error=EmailRequired&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }

    if (process.env.NODE_ENV === "development" && providerIds.devBypass) {
      try {
        await signIn("dev-bypass", { email: email.trim().toLowerCase(), redirectTo: callbackUrl });
      } catch (error) {
        if (error instanceof AuthError) {
          console.error("[dev-bypass] AuthError type:", error.type, " cause:", error.cause);
          redirect(`/login?error=DevBypassUserNotActive&callbackUrl=${encodeURIComponent(callbackUrl)}`);
        }
        throw error;
      }
      return;
    }

    if (!providerIds.email) {
      redirect(`/login?error=EmailProviderNotConfigured&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    try {
      await signIn("email", { email, redirectTo: callbackUrl });
    } catch (error) {
      if (error instanceof AuthError) {
        console.error("[login] AuthError type:", error.type, " cause:", error.cause);
        redirect(
          `/login?error=${error.type === "AccessDenied" ? "EmailNotRegistered" : "ServerConfiguration"}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        );
      }
      throw error;
    }
  }

  const errorMessage = params.error ? (ERROR_MESSAGES[params.error] ?? "Login failed. Please try again.") : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
            Southwest Digital
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            {providerIds.email && !process.env.NODE_ENV?.startsWith("dev")
              ? "Enter your work email to receive a sign-in link."
              : "Enter your work email to sign in."}
          </p>

          {errorMessage && (
            <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errorMessage}
            </p>
          )}

          {session?.user?.id && session.user.status !== UserStatus.ACTIVE && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Signed in, but this account is not active. Ask an admin to activate it.
            </p>
          )}

          {providerIds.google && (
            <div className="mt-6">
              <GoogleSignInButton callbackUrl={callbackUrl} />
            </div>
          )}

          {providerIds.google && (
            <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              <span>or</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          )}

          <form action={handleSignIn} className={providerIds.google ? "" : "mt-6"}>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
              Work email
            </label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="you@bookkeepingconroe.com"
            />
            <button
              type="submit"
              className="mt-3 w-full cursor-pointer rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-700"
            >
              {process.env.NODE_ENV === "development" ? "Sign In" : "Send Magic Link"}
            </button>
          </form>
        </div>

        {devUsers.length > 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Dev — sign in as
            </p>
            <div className="flex flex-col gap-1">
              {[PlatformRole.OWNER, PlatformRole.ADMIN, PlatformRole.NONE].flatMap((role) =>
                devUsers
                  .filter((u) => u.platformRole === role)
                  .map((u) => (
                    <form key={u.id} action={handleSignIn}>
                      <input type="hidden" name="email" value={u.email} />
                      <button
                        type="submit"
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-amber-100"
                      >
                        <span className="font-medium text-slate-800">{u.email}</span>
                        <span className="ml-auto rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          {role}
                        </span>
                      </button>
                    </form>
                  )),
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
