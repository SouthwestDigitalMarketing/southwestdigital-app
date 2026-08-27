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
  Globe,
  PlayCircle,
  FileText,
  Contact,
  Calculator,
  ListChecks,
  Calendar,
  Mail,
  GraduationCap,
  ExternalLink,
  ImagePlay,
  Tag,
} from "lucide-react";
import { selectBrand } from "@/app/select-brand/actions";
import { useBrand } from "@/lib/brands/context";
import { signOutAction } from "./actions";

const NAV: Array<{
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  dividerAfter?: boolean;
}> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Website", href: "/website", icon: Globe },
  { label: "YouTube", href: "/youtube", icon: PlayCircle },
  { label: "Reviews", href: "/reviews", icon: Star, dividerAfter: true },
  { label: "Contacts", href: "/contacts", icon: Contact },
  { label: "Pipeline", href: "/pipeline", icon: TrendingUp },
  { label: "Offers", href: "/offers", icon: FileText, dividerAfter: true },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Team", href: "/team", icon: Users },
  { label: "Media", href: "/media", icon: ImagePlay },
  { label: "Tags", href: "/tags", icon: Tag },
  { label: "Settings", href: "/settings", icon: Settings, dividerAfter: true },
];

const TOOL_ICONS: Record<string, React.ElementType> = {
  quickbooks: Calculator,
  double: ListChecks,
  calendar: Calendar,
  mail: Mail,
  skool: GraduationCap,
};

function NavItem({
  href,
  icon: Icon,
  label,
  exact = false,
  accent,
  isLight,
  navTextColor,
  onNavigate,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
  accent: string;
  isLight: boolean;
  navTextColor: string;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "" : isLight ? "hover:bg-black/5" : "hover:bg-white/10"
      }`}
      style={{
        backgroundColor: active ? accent : undefined,
        color: active ? "#ffffff" : navTextColor,
      }}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

function ExternalNavItem({
  href,
  icon: Icon,
  label,
  isLight,
  navTextColor,
  onNavigate,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  isLight: boolean;
  navTextColor: string;
  onNavigate: () => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isLight ? "hover:bg-black/5" : "hover:bg-white/10"
      }`}
      style={{ color: navTextColor }}
    >
      <Icon size={16} />
      <span className="flex-1 truncate">{label}</span>
      <ExternalLink size={12} className="shrink-0 opacity-50" />
    </a>
  );
}

export function AppShell({
  children,
  user,
  accessibleBrands,
  activeBrandId,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null };
  accessibleBrands: Array<{ id: string; name: string }>;
  activeBrandId: string;
}) {
  const { brand } = useBrand();
  const [open, setOpen] = useState(false);

  const primary = brand.theme?.primaryColor ?? "#17324d";
  const accent = brand.theme?.accentColor ?? "#d79b3b";
  const mode = brand.theme?.mode === "dark" || brand.theme?.mode === "light" ? brand.theme.mode : "system";
  const isLight = mode === "light";
  const sidebarLogoType = brand.theme?.sidebarLogoType === "logo" ? "logo" : "mark";
  const appearance = primary.toLowerCase() === "#111111" ? "grok" : "standard";

  const sidebarLightLogo = sidebarLogoType === "logo" ? brand.theme?.logoUrl : brand.theme?.logoMarkUrl;
  const sidebarDarkLogo = sidebarLogoType === "logo" ? brand.theme?.logoDarkUrl : brand.theme?.logoMarkDarkUrl;
  // Light mode: prefer light logo; dark mode: prefer dark logo; fall back to the other variant
  const sidebarDisplayLogo = isLight
    ? (sidebarLightLogo ?? sidebarDarkLogo)
    : (sidebarDarkLogo ?? sidebarLightLogo);
  const sidebarLogoClass =
    sidebarLogoType === "logo" ? "max-h-8 max-w-44 object-contain" : "h-8 w-8 rounded object-contain";

  const darkColor = brand.theme?.darkColor ?? primary;
  const navTextColor = isLight ? darkColor : "rgba(255,255,255,0.7)";
  const navMutedColor = isLight ? `${darkColor}80` : "rgba(255,255,255,0.5)";
  const sidebarBg = isLight ? "#ffffff" : "var(--sidebar-background)";
  const dividerColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
  const dividerNavColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";

  const displayName = user.name ?? user.email ?? "User";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full w-64 shrink-0 flex-col" style={{ backgroundColor: sidebarBg }}>
      <div
        className="flex h-16 items-center px-5"
        style={{ borderBottom: `1px solid ${dividerColor}` }}
      >
        {sidebarDisplayLogo ? (
          <img
            src={sidebarDisplayLogo}
            alt={sidebarLogoType === "logo" ? brand.name : ""}
            className={sidebarLogoClass}
          />
        ) : null}
        {!sidebarDisplayLogo ? (
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: navTextColor }}>
            {brand.name}
          </span>
        ) : null}
      </div>
      {accessibleBrands.length > 1 ? (
        <form action={selectBrand} className="px-3 pb-3">
          <label className="sr-only" htmlFor="active-brand">
            Switch brand
          </label>
          <select
            id="active-brand"
            name="brandId"
            defaultValue={activeBrandId}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{
              color: navTextColor,
              backgroundColor: isLight ? "#ffffff" : "transparent",
              borderColor: dividerColor,
            }}
          >
            {accessibleBrands.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </form>
      ) : null}

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.map(({ href, icon, label, exact, dividerAfter }) => (
          <div key={href}>
            <NavItem
              href={href}
              icon={icon}
              label={label}
              exact={exact}
              accent={accent}
              isLight={isLight}
              navTextColor={navTextColor}
              onNavigate={() => setOpen(false)}
            />
            {dividerAfter ? (
              <div
                className="mx-3 my-2"
                style={{ borderTop: `1px solid ${dividerNavColor}` }}
              />
            ) : null}
          </div>
        ))}
        {(brand.toolLinks ?? []).map((link) => (
          <ExternalNavItem
            key={link.key}
            href={link.url}
            icon={TOOL_ICONS[link.key] ?? ExternalLink}
            label={link.label}
            isLight={isLight}
            navTextColor={navTextColor}
            onNavigate={() => setOpen(false)}
          />
        ))}
      </nav>

      <div
        className="px-3 py-4"
        style={{ borderTop: `1px solid ${dividerColor}` }}
      >
        <div className="flex items-center gap-3 px-3 py-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: navTextColor }}>{displayName}</p>
            {user.name && user.email && (
              <p className="truncate text-xs" style={{ color: navMutedColor }}>{user.email}</p>
            )}
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign out"
              className="rounded p-1 opacity-60 transition-opacity hover:opacity-100"
              style={{ color: navTextColor }}
            >
              <LogOut size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div
      data-theme={mode}
      data-appearance={appearance}
      className="flex h-screen overflow-hidden"
      style={{
        backgroundColor: "var(--app-canvas)",
        "--brand-primary": primary,
        "--brand-accent": accent,
      } as React.CSSProperties}
    >
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
