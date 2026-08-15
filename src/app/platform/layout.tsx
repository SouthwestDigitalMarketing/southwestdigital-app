import type { ReactNode } from "react";
import Link from "next/link";
import { signOutOfPortal } from "@/app/portal/actions";
import { requirePlatformAdministrator } from "@/lib/platform/authorization";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const { session } = await requirePlatformAdministrator();

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6">
          <Link href="/platform/brands">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
              Southwest Digital Marketing
            </p>
            <p className="text-lg font-semibold">Platform administration</p>
          </Link>
          <nav className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Link href="/platform/brands" className="rounded-full px-4 py-2 hover:bg-white/10">
              Brands
            </Link>
            <Link href="/portal" className="rounded-full px-4 py-2 hover:bg-white/10">
              Client portal
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-300">
            <span>{session.user.email}</span>
            <form action={signOutOfPortal}>
              <button type="submit" className="cursor-pointer rounded-full border border-white/20 px-4 py-2">
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
