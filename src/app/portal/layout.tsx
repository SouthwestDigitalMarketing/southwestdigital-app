import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { selectBrand } from "@/app/select-brand/actions";
import { isPlatformAdministrator } from "@/lib/platform/access";
import { requireActiveBrandContext } from "@/lib/tenancy/current";
import { signOutOfPortal } from "./actions";

type BrandCssProperties = CSSProperties & {
  "--theme-light": string;
  "--theme-accent": string;
  "--brand-background": string;
  "--brand-foreground": string;
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { session, activeBrand, accessibleBrands } = await requireActiveBrandContext();
  const style: BrandCssProperties = {
    "--theme-light": activeBrand.theme?.lightColor ?? "#17324d",
    "--theme-accent": activeBrand.theme?.accentColor ?? "#d79b3b",
    "--brand-background": activeBrand.theme?.backgroundColor ?? "#f7f8fa",
    "--brand-foreground": activeBrand.theme?.foregroundColor ?? "#17202a",
  };

  return (
    <main style={style} className="min-h-screen bg-[var(--brand-background)] text-[var(--brand-foreground)]">
      <header className="border-b border-black/10 bg-white/95 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5">
          <Link href="/portal" className="min-w-48">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Active brand
            </p>
            <p className="text-xl font-semibold text-[var(--theme-light)]">{activeBrand.name}</p>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-semibold text-slate-700">
            <Link href="/portal" className="rounded-full px-3 py-2 hover:bg-slate-100">
              Home
            </Link>
            <Link href="/portal/contacts" className="rounded-full px-3 py-2 hover:bg-slate-100">
              Contacts
            </Link>
            <Link href="/portal/customers" className="rounded-full px-3 py-2 hover:bg-slate-100">
              Customers
            </Link>
            <Link href="/portal/leads" className="rounded-full px-3 py-2 hover:bg-slate-100">
              Leads
            </Link>
            {isPlatformAdministrator(session.user.platformRole) ? (
              <Link href="/platform/brands" className="rounded-full px-3 py-2 hover:bg-slate-100">
                Platform admin
              </Link>
            ) : null}
          </nav>

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
      {children}
    </main>
  );
}
