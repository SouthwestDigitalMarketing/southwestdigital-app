"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Star,
  TrendingUp,
  Users,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { useBrand } from "@/lib/brands/context";
import { signOutAction } from "./actions";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Reviews", href: "/reviews", icon: Star },
  { label: "Pipeline", href: "/pipeline", icon: TrendingUp },
  { label: "Team", href: "/team", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];

function NavItem({
  href,
  icon: Icon,
  label,
  exact = false,
  accent,
  onNavigate,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
  accent: string;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
      style={active ? { backgroundColor: accent } : undefined}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null };
}) {
  const { brand } = useBrand();
  const [open, setOpen] = useState(false);

  const primary = brand.theme?.primaryColor ?? "#17324d";
  const accent = brand.theme?.accentColor ?? "#d79b3b";
  const bg = brand.theme?.backgroundColor ?? "#f7f8fa";

  const displayName = user.name ?? user.email ?? "User";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full w-64 shrink-0 flex-col" style={{ backgroundColor: primary }}>
      <div
        className="flex h-16 items-center px-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <span className="text-sm font-bold uppercase tracking-widest text-white">
          {brand.name}
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map(({ href, icon, label, exact }) => (
          <NavItem
            key={href}
            href={href}
            icon={icon}
            label={label}
            exact={exact}
            accent={accent}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </nav>

      <div
        className="px-3 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center gap-3 px-3 py-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            {user.name && user.email && (
              <p className="truncate text-xs text-white/50">{user.email}</p>
            )}
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign out"
              className="rounded p-1 text-white/50 transition-colors hover:text-white"
            >
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: bg }}>
      <aside className="hidden lg:flex">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full">{sidebar}</aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded p-2 text-slate-500 hover:bg-slate-100"
          >
            <Menu size={20} />
          </button>
          <span className="ml-3 text-sm font-semibold text-slate-900">{brand.name}</span>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
