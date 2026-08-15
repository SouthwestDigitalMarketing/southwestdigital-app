import type { CSSProperties } from "react";
import { UserStatus } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ACTIVE_BRAND_COOKIE } from "@/lib/brands/active-brand";
import { selectCurrentBrand } from "@/lib/brands/access";
import { effectiveRequestHostname } from "@/lib/brands/request";
import { getAccessibleBrands, resolveAppBrandByHostname } from "@/lib/brands/repository";
import { selectBrand } from "@/app/select-brand/actions";
import { signOutOfPortal } from "./actions";

type BrandCssProperties = CSSProperties & {
  "--brand-primary": string;
  "--brand-accent": string;
  "--brand-background": string;
  "--brand-foreground": string;
};

export default async function PortalPage() {
  const session = await auth();
  if (!session?.user || session.user.status !== UserStatus.ACTIVE) redirect("/login");

  const [headerStore, cookieStore, accessibleBrands] = await Promise.all([
    headers(),
    cookies(),
    getAccessibleBrands(session.user.id, session.user.platformRole),
  ]);
  const hostname = effectiveRequestHostname({
    requestHostname: headerStore.get("host"),
    developmentOverride: process.env.DEV_BRAND_HOST,
    nodeEnv: process.env.NODE_ENV,
  });
  const entryBrand = await resolveAppBrandByHostname(hostname);
  const activeBrandId = selectCurrentBrand({
    accessibleBrandIds: accessibleBrands.map(({ id }) => id),
    activeBrandId: cookieStore.get(ACTIVE_BRAND_COOKIE)?.value,
    entryBrandId: entryBrand?.id,
  });
  if (!activeBrandId) redirect("/select-brand");

  const activeBrand = accessibleBrands.find(({ id }) => id === activeBrandId);
  if (!activeBrand) redirect("/select-brand");

  const style: BrandCssProperties = {
    "--brand-primary": activeBrand.theme?.primaryColor ?? "#17324d",
    "--brand-accent": activeBrand.theme?.accentColor ?? "#d79b3b",
    "--brand-background": activeBrand.theme?.backgroundColor ?? "#f7f8fa",
    "--brand-foreground": activeBrand.theme?.foregroundColor ?? "#17202a",
  };

  return (
    <main style={style} className="min-h-screen bg-[var(--brand-background)] text-[var(--brand-foreground)]">
      <header className="border-b border-black/10 bg-white/90 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Active brand
            </p>
            <h1 className="text-xl font-semibold text-[var(--brand-primary)]">{activeBrand.name}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {accessibleBrands.length > 1 ? (
              <details className="relative">
                <summary className="cursor-pointer rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">
                  Switch brand
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-64 space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {accessibleBrands.map((brand) => (
                    <form key={brand.id} action={selectBrand}>
                      <input type="hidden" name="brandId" value={brand.id} />
                      <button
                        type="submit"
                        className="w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-100"
                      >
                        {brand.name}
                      </button>
                    </form>
                  ))}
                </div>
              </details>
            ) : null}
            <form action={signOutOfPortal}>
              <button type="submit" className="cursor-pointer px-3 py-2 text-sm text-slate-600">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-3xl border border-black/10 bg-white p-10 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">
            Platform foundation
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">Welcome to {activeBrand.name}</h2>
          <p className="mt-4 max-w-2xl leading-7 text-slate-600">
            Your active brand is resolved securely. Application modules will be introduced here as
            they are migrated onto the new tenant boundary.
          </p>
        </div>
      </section>
    </main>
  );
}

