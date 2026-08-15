import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, authProviderAvailability } from "@/auth";
import { BrandShell } from "@/components/brand-shell";
import { isPlatformHostname } from "@/lib/brands/active-brand";
import { effectiveRequestHostname } from "@/lib/brands/request";
import { resolveAppBrandByHostname } from "@/lib/brands/repository";
import { requestMagicLink, signInWithGoogle } from "./actions";

type LoginSearchParams = Promise<{ error?: string }>;

const errorMessages: Record<string, string> = {
  AccessDenied: "This account does not have access to the requested portal.",
  InvalidEmail: "Enter a valid email address.",
  OAuthAccountNotLinked: "Use the same sign-in method associated with this account.",
};

export default async function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  const headerStore = await headers();
  const hostname = effectiveRequestHostname({
    requestHostname: headerStore.get("host"),
    developmentOverride: process.env.DEV_BRAND_HOST,
    nodeEnv: process.env.NODE_ENV,
  });
  const brand = await resolveAppBrandByHostname(hostname);
  const isPlatform = isPlatformHostname(hostname, process.env.PLATFORM_BASE_URL);
  const params = await searchParams;
  const session = await auth();

  if (!brand && !isPlatform) {
    return (
      <BrandShell brand={null}>
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Portal not configured</h1>
          <p className="mt-3 leading-6 text-slate-600">
            This hostname is not connected to an active Southwest Digital App portal.
          </p>
        </section>
      </BrandShell>
    );
  }

  if (session?.user) redirect("/auth/complete");

  const message = params.error ? errorMessages[params.error] ?? "Sign-in could not be completed." : null;

  return (
    <BrandShell brand={brand}>
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sign in with Google or request a secure email link.
        </p>

        {message ? (
          <p className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p>
        ) : null}

        <div className="mt-7 space-y-4">
          {authProviderAvailability.google ? (
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="w-full cursor-pointer rounded-full border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Continue with Google
              </button>
            </form>
          ) : null}

          {authProviderAvailability.google && authProviderAvailability.email ? (
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          ) : null}

          {authProviderAvailability.email ? (
            <form action={requestMagicLink} className="space-y-3">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-[var(--brand-accent)] focus:ring-2"
              />
              <button
                type="submit"
                className="w-full cursor-pointer rounded-full bg-[var(--brand-primary)] px-5 py-3 font-semibold text-white transition hover:opacity-90"
              >
                Email me a sign-in link
              </button>
            </form>
          ) : null}

          {!authProviderAvailability.google && !authProviderAvailability.email ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Authentication providers have not been configured for this environment.
            </p>
          ) : null}
        </div>
      </section>
    </BrandShell>
  );
}

