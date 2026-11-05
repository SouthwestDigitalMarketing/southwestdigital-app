import type { ReactNode } from "react";
import Link from "next/link";
import { signOutOfPortal } from "@/app/portal/actions";
import { requirePlatformAdministrator } from "@/lib/platform/authorization";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const { session } = await requirePlatformAdministrator();

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 px-4 py-3 text-white md:px-6 md:py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 md:flex-none">
            <Link href="/platform/brands" className="block">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400 md:text-xs md:tracking-[0.2em]">
                Southwest Digital Marketing
              </p>
              <p className="text-lg font-semibold leading-tight">Platform administration</p>
            </Link>
            <p className="mt-0.5 truncate text-xs text-slate-400 md:hidden">{session.user.email}</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300 md:order-last md:ml-auto">
            <span className="hidden md:inline">{session.user.email}</span>
            <form action={signOutOfPortal}>
              <button type="submit" className="cursor-pointer rounded-full border border-white/20 px-4 py-2 text-white">
                Sign out
              </button>
            </form>
          </div>
          <nav className="order-last flex w-full gap-2 text-sm font-semibold text-slate-200 md:order-none md:w-auto md:items-center">
            <Link href="/platform/brands" className="flex-1 rounded-full bg-white/5 px-4 py-2.5 text-center hover:bg-white/10 md:flex-none md:bg-transparent md:py-2">
              Brands
            </Link>
            <Link href="/portal" className="flex-1 rounded-full bg-white/5 px-4 py-2.5 text-center hover:bg-white/10 md:flex-none md:bg-transparent md:py-2">
              Client portal
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
