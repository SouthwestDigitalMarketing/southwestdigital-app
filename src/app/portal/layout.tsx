import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { selectBrand } from "@/app/select-brand/actions";
import { requireActiveBrandContext } from "@/lib/tenancy/current";
import { signOutOfPortal } from "./actions";

type BrandCssProperties = CSSProperties & {
  "--brand-primary": string;
  "--brand-accent": string;
  "--brand-background": string;
  "--brand-foreground": string;
};

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { activeBrand, accessibleBrands } = await requireActiveBrandContext();
  const style: BrandCssProperties = {
    "--brand-primary": activeBrand.theme?.primaryColor ?? "#17324d",
    "--brand-accent": activeBrand.theme?.accentColor ?? "#d79b3b",
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
            <p className="text-xl font-semibold text-[var(--brand-primary)]">{activeBrand.name}</p>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-semibold text-slate-700">
            <Link href="/portal" className="rounded-full px-3 py-2 hover:bg-slate-100">
              Home
            </Link>
            <Link href="/portal/contacts" className="rounded-full px-3 py-2 hover:bg-slate-100">
              Contacts
            </Link>
            <Link href="/portal/leads" className="rounded-full px-3 py-2 hover:bg-slate-100">
              Leads
            </Link>
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

