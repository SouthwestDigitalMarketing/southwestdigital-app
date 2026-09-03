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
  DollarSign,
  Contact,
  Calculator,
  ListChecks,
  Calendar,
  Mail,
  GraduationCap,
  ExternalLink,
  ImagePlay,
  Package,
  Tag,
  BadgePercent,
  ChevronDown,
  ScrollText,
  X,
} from "lucide-react";
import { selectBrand } from "@/app/select-brand/actions";
import { useBrand } from "@/lib/brands/context";
import {
  appCanvasGradient,
  appThemeCssVariables,
  chartPaletteCssVariables,
} from "@/lib/brands/themeTokens";
import { normalizeThemeChoice, resolveEffectiveThemeColors } from "@/lib/brands/themePresets";
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
  { label: "CRM", href: "/pipeline", icon: TrendingUp },
  { label: "Services", href: "/services", icon: Package },
  { label: "Offers", href: "/offers", icon: DollarSign },
  { label: "Agreements", href: "/agreements", icon: ScrollText },
  { label: "Discounts", href: "/discounts", icon: BadgePercent, dividerAfter: true },
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
  isLight,
  navTextColor,
  onNavigate,
  collapsed,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
  isLight: boolean;
  navTextColor: string;
  onNavigate: () => void;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${
        active ? "ui-nav-active" : isLight ? "hover:bg-black/5" : "hover:bg-white/10"
      }`}
      style={active ? undefined : { color: navTextColor }}
    >
      <Icon size={16} />
      <span className={collapsed ? "hidden" : undefined}>{label}</span>
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
  collapsed,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  isLight: boolean;
  navTextColor: string;
  onNavigate: () => void;
  collapsed: boolean;
}) {
  return (
    <a
      href={href}
      title={collapsed ? label : undefined}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${
        isLight ? "hover:bg-black/5" : "hover:bg-white/10"
      }`}
      style={{ color: navTextColor }}
    >
      <Icon size={16} />
      <span className={collapsed ? "hidden" : "flex-1 truncate"}>{label}</span>
      {!collapsed ? <ExternalLink size={12} className="shrink-0 opacity-50" /> : null}
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
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [resizingSidebar, setResizingSidebar] = useState(false);

  const themePreset = normalizeThemeChoice(brand.theme?.themePreset);
  const effective = resolveEffectiveThemeColors({
    themePreset,
    lightColor: brand.theme?.lightColor,
    darkColor: brand.theme?.darkColor,
    accentColor: brand.theme?.accentColor,
    mode: brand.theme?.mode,
  });
  const light = effective.lightColor;
  const accent = effective.accentColor;
  const mode = effective.mode;
  const isLight = mode === "light";
  const sidebarLogoType = brand.theme?.sidebarLogoType === "logo" ? "logo" : "mark";
  const appearance = themePreset === "grok" ? "grok" : "standard";

  const sidebarLightLogo = sidebarLogoType === "logo" ? brand.theme?.logoUrl : brand.theme?.logoMarkUrl;
  const sidebarDarkLogo = sidebarLogoType === "logo" ? brand.theme?.logoDarkUrl : brand.theme?.logoMarkDarkUrl;
  // Light mode: prefer light logo; dark mode: prefer dark logo; fall back to the other variant
  const sidebarDisplayLogo = isLight
    ? (sidebarLightLogo ?? sidebarDarkLogo)
    : (sidebarDarkLogo ?? sidebarLightLogo);
  const sidebarMarkLogo = isLight
    ? (brand.theme?.logoMarkUrl ?? brand.theme?.logoMarkDarkUrl)
    : (brand.theme?.logoMarkDarkUrl ?? brand.theme?.logoMarkUrl);
  const sidebarLogo = collapsed ? (sidebarMarkLogo ?? sidebarDisplayLogo) : sidebarDisplayLogo;
  const sidebarLogoClass =
    !collapsed && sidebarLogoType === "logo"
      ? "brand-asset-fit brand-asset-fit-left"
      : "h-8 w-8 rounded object-contain";

  const darkColor = effective.darkColor;
  const themeVariables = appThemeCssVariables({
    mode,
    dark: darkColor,
  });
  const chartVariables = chartPaletteCssVariables({
    mode,
    dark: darkColor,
    accent,
  });
  const mainPanelBackground = appCanvasGradient(mode);
  const navTextColor = isLight ? darkColor : "rgba(255,255,255,0.7)";
  const navMutedColor = isLight ? `${darkColor}80` : "rgba(255,255,255,0.5)";
  const sidebarBg = isLight ? "#ffffff" : "var(--app-canvas)";
  const dividerColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
  const dividerNavColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";

  const displayName = user.name ?? user.email ?? "User";
  const profileName = user.name?.trim().split(/\s+/)[0] || "User";
  const initials = profileName.slice(0, 1).toUpperCase();

  const sidebar = (
    <div
      className="relative flex h-full shrink-0 flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        backgroundColor: sidebarBg,
        width: `${collapsed ? 64 : sidebarWidth}px`,
        borderRight: `1px solid ${dividerColor}`,
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div
        className={`py-1 ${collapsed ? "px-1" : "px-3"}`}
        style={{ borderBottom: `1px solid ${dividerColor}` }}
      >
        <div className={`flex items-center py-1 ${collapsed ? "justify-center gap-2 px-0" : "gap-3 px-3"}`}>
          <button
            type="button"
            aria-label="Open profile"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((isOpen) => !isOpen)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{
              backgroundColor: isLight ? darkColor : light,
              color: isLight ? "#ffffff" : darkColor,
            }}
          >
            {initials}
          </button>
          <div className={`min-w-0 flex-1 ${collapsed ? "hidden" : ""}`}>
            <p className="truncate text-sm font-medium" style={{ color: navTextColor }}>{profileName}</p>
          </div>
        </div>
      </div>
      <div
        className={`w-full min-w-0 pb-3 pt-4 ${collapsed ? "px-1" : "px-5"}`}
        style={{ borderBottom: `1px solid ${dividerColor}` }}
      >
        <div className={`flex h-8 w-full min-w-0 items-center ${collapsed ? "justify-center" : ""}`}>
          {sidebarLogo ? (
            <div className={!collapsed && sidebarLogoType === "logo" ? "h-8 min-w-0 w-full" : "h-8 w-8 shrink-0"}>
              <img
                src={sidebarLogo}
                alt={!collapsed && sidebarLogoType === "logo" ? brand.name : ""}
                className={sidebarLogoClass}
              />
            </div>
          ) : null}
          {!sidebarLogo ? (
            <span className="text-sm font-bold uppercase tracking-widest" style={{ color: navTextColor }}>
              {brand.name}
            </span>
          ) : null}
        </div>
        {accessibleBrands.length > 1 && !collapsed ? (
          <form action={selectBrand} className="mt-3">
            <label className="sr-only" htmlFor="active-brand">
              Switch brand
            </label>
            <div className="relative">
              <select
                id="active-brand"
                name="brandId"
                defaultValue={activeBrandId}
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
                className="w-full appearance-none rounded-lg border py-2 pl-3 pr-10 text-sm"
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
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: navMutedColor }}
              />
            </div>
          </form>
        ) : null}
      </div>

      <nav className={`flex-1 space-y-0.5 py-4 ${collapsed ? "px-2" : "px-3"}`}>
        {NAV.map(({ href, icon, label, exact, dividerAfter }) => (
          <div key={href}>
            <NavItem
              href={href}
              icon={icon}
              label={label}
              exact={exact}
              isLight={isLight}
              navTextColor={navTextColor}
              onNavigate={() => setOpen(false)}
              collapsed={collapsed}
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
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setResizingSidebar(true);
        }}
        onPointerMove={(event) => {
          if (!resizingSidebar) return;
          const nextWidth = Math.max(64, Math.min(320, event.clientX));
          if (nextWidth <= 96) {
            setCollapsed(true);
            setSidebarWidth(64);
          } else {
            setCollapsed(false);
            setSidebarWidth(nextWidth);
          }
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          setResizingSidebar(false);
        }}
        onPointerCancel={() => setResizingSidebar(false)}
        className={`absolute right-0 top-0 z-10 h-full w-2 translate-x-1/2 cursor-ew-resize ${resizingSidebar ? "bg-slate-400/20" : "hover:bg-slate-400/10"}`}
        style={{ touchAction: "none" }}
      />

    </div>
  );

  return (
    <div
      data-theme={mode}
      data-appearance={appearance}
      className="flex h-screen overflow-hidden"
      style={{
        backgroundColor: "var(--app-canvas)",
        "--theme-light": light,
        "--theme-dark": darkColor,
        "--theme-accent": accent,
        ...themeVariables,
        ...chartVariables,
        ...(isLight && themePreset !== "grok" ? { "--app-canvas": light } : {}),
      } as React.CSSProperties}
    >
      <aside className="hidden lg:flex">{sidebar}</aside>

      {profileOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="presentation"
          onClick={() => setProfileOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-dialog-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="profile-dialog-title" className="text-lg font-semibold text-slate-900">Profile</h2>
                <p className="mt-1 text-sm text-slate-700">{displayName}</p>
                {user.email ? <p className="text-sm text-slate-500">{user.email}</p> : null}
              </div>
              <button
                type="button"
                aria-label="Close profile"
                title="Close profile"
                onClick={() => setProfileOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <form action={signOutAction} className="mt-5">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}

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

        <main
          className="flex-1 overflow-y-auto"
          style={{ background: mainPanelBackground }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
