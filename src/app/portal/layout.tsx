import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { selectBrand } from "@/app/select-brand/actions";
import { isPlatformAdministrator } from "@/lib/platform/access";
import { requireActiveBrandContext } from "@/lib/tenancy/current";
import { signOutOfPortal } from "./actions";

type BrandCssProperties = CSSProperties & {
  "--theme-light": string;
  "--theme-dark": string;
  "--theme-accent": string;
  "--brand-background": string;
  "--brand-foreground": string;
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { session, activeBrand, accessibleBrands } = await requireActiveBrandContext();
  const style: BrandCssProperties = {
    "--theme-light": activeBrand.theme?.lightColor ?? "#17324d",
    "--theme-dark": activeBrand.theme?.darkColor ?? "#17202a",
    "--theme-accent": activeBrand.theme?.accentColor ?? "#d79b3b",
    "--brand-background": activeBrand.theme?.backgroundColor ?? "#f7f8fa",
    "--brand-foreground": activeBrand.theme?.foregroundColor ?? "#17202a",
  };

  return (
    <main style={style} className="min-h-screen bg-[var(--brand-background)] text-[var(--brand-foreground)]">
      <header className="border-b border-black/10 bg-white/95 px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 sm:gap-5">
          <Link href="/portal" className="min-w-48">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Active brand
            </p>
            <p className="text-lg font-semibold text-[var(--theme-dark)] sm:text-xl">{activeBrand.name}</p>
          </Link>

          <nav className="flex w-full items-center gap-1 overflow-x-auto text-sm font-semibold text-slate-700 sm:w-auto [&_a]:whitespace-nowrap [&_a]:rounded-full [&_a]:px-3 [&_a]:py-2.5 [&_a]:hover:bg-slate-100 sm:[&_a]:py-2">
            <Link href="/portal">
              Home
            </Link>
            <Link href="/portal/contacts">
              Contacts
            </Link>
            <Link href="/portal/customers">
              Customers
            </Link>
            <Link href="/portal/leads">
              Leads
            </Link>
            {isPlatformAdministrator(session.user.platformRole) ? (
              <Link href="/platform/brands">
                Platform admin
              </Link>
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {accessibleBrands.length > 1 ? (
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold sm:py-2">
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
              <button type="submit" className="cursor-pointer px-3 py-2.5 text-sm text-slate-600 sm:py-2">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
