"use client";

import { useEffect, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Star,
  TrendingUp,
  Users,
  Settings,
  Menu,
  Moon,
  LogOut,
  Globe,
  Clapperboard,
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
  Radar,
  MapPinned,
  ScrollText,
  Sun,
  X,
  FileText,
  EyeOff,
} from "lucide-react";
import { useBrand } from "@/lib/brands/context";
import {
  appCanvasGradient,
  appThemeCssVariables,
  chartPaletteCssVariables,
} from "@/lib/brands/themeTokens";
import { normalizeThemeChoice, resolveEffectiveThemeColors } from "@/lib/brands/themePresets";
import { signOutAction } from "./actions";
import { Modal } from "@/components/Modal";
import { KeyboardProvider } from "@/components/keyboard/KeyboardProvider";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { privacyCovers } from "@/lib/privacy";
import { APP_COMMANDS } from "@/lib/keyboard/commands";

const NAV: Array<{
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  dividerAfter?: boolean;
}> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Operations", href: "/operations", icon: ListChecks },
  { label: "Scanner", href: "/scanner", icon: Radar },
  { label: "Local SEO", href: "/local-seo", icon: MapPinned },
  { label: "Website", href: "/website", icon: Globe },
  { label: "Showrunner", href: "/showrunner", icon: Clapperboard },
  { label: "Financial Reports", href: "/reports", icon: FileText },
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
  website: Globe,
};

/** A small spinner on the tapped item until its page (or loading skeleton) is on screen. */
function NavPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`ml-auto h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent transition-opacity ${
        pending ? "opacity-60" : "opacity-0"
      }`}
    />
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  exact = false,
  isLight,
  navTextColor,
  collapsed,
  onNavigate,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
  isLight: boolean;
  navTextColor: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      // Tapping the page you are on navigates nowhere, so close the menu now; any other item
      // keeps it open (with a spinner) until the new page arrives, instead of revealing the old one.
      onClick={active ? onNavigate : undefined}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${
        active ? "ui-nav-active" : isLight ? "hover:bg-black/5" : "hover:bg-white/10"
      }`}
      style={active ? undefined : { color: navTextColor }}
    >
      <Icon size={16} />
      <span className={collapsed ? "hidden" : undefined}>{label}</span>
      {collapsed ? null : <NavPending />}
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
  activeBrandId,
  privacy,
  isPlatformOperator,
  platformAdminHref,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null };
  accessibleBrands: Array<{ id: string; name: string }>;
  activeBrandId: string;
  /** Privacy mode (cookie, read by the layout): covered pages hide names, the rest are blurred. */
  privacy: boolean;
  isPlatformOperator: boolean;
  platformAdminHref: string;
}) {
  const { brand } = useBrand();
  const [deviceTheme, setDeviceTheme] = useState<"light" | "dark" | null>(null);
  const [open, setOpen] = useState(false);
  // The phone menu closes when the route actually changes (Tom, 2026-11-20: closing it on tap
  // showed the previous page, usually the Dashboard, until the new one loaded).
  const pathname = usePathname();
  // Header Scan button (sop-money-playbook): Lochside operators only. Contigo
  // is a separate tenant and the scan sources are Lochside's.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }
  const curtain = privacy && !privacyCovers(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const deviceThemeKey = `swapp-device-theme:${activeBrandId}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(deviceThemeKey);
      // Read browser-only preference after hydration to avoid a server/client theme mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeviceTheme(saved === "dark" || saved === "light" ? saved : null);
    } catch {
      setDeviceTheme(null);
    }
  }, [deviceThemeKey]);

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
  const mode = deviceTheme ?? effective.mode;
  const isLight = mode === "light";
  const appearance = themePreset === "grok" ? "grok" : "standard";

  function toggleDeviceTheme() {
    const next = mode === "dark" ? "light" : "dark";
    setDeviceTheme(next);
    try {
      window.localStorage.setItem(deviceThemeKey, next);
    } catch {
      // Keep the current view usable when browser storage is unavailable.
    }
  }

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
  const sidebarBg = isLight ? "#ffffff" : "var(--app-canvas)";
  const dividerColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
  const dividerNavColor = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";


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
      {/* No profile row: one user (Tom, 2026-11-24). Sign out is the last item in the menu. */}
      {/* No brand logo or brand switcher: SWapp is Lochside LLC's one app (Tom, 2026-11-24). */}

      {/* Scan lives on the Scanner page now (Tom, 2026-11-24); on a computer the privacy switch keeps this row. */}
      <div className={`flex ${collapsed ? "justify-center px-1" : "px-5"} py-3 max-lg:hidden`} style={{ borderBottom: `1px solid ${dividerColor}` }}>
        <PrivacyToggle on={privacy} iconOnly={collapsed} />
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
              collapsed={collapsed}
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
        {isPlatformOperator ? <NavItem href={platformAdminHref} icon={Building2} label="Platform admin" isLight={isLight} navTextColor={navTextColor} collapsed={collapsed} onNavigate={() => setOpen(false)} /> : null}
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
        <form action={signOutAction}>
          <button
            type="submit"
            title={collapsed ? "Sign out" : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${isLight ? "hover:bg-black/5" : "hover:bg-white/10"}`}
            style={{ color: navTextColor }}
          >
            <LogOut size={16} />
            <span className={collapsed ? "hidden" : undefined}>Sign out</span>
          </button>
        </form>
      </nav>

      <div
        data-sidebar-resize-handle
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        tabIndex={0}
        aria-valuemin={64}
        aria-valuemax={320}
        aria-valuenow={collapsed ? 64 : sidebarWidth}
        aria-valuetext={collapsed ? "Collapsed" : `${Math.round(sidebarWidth)} pixels`}
        title="Resize sidebar: Left/Right arrows, Home to collapse, End to expand"
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          const width = collapsed ? 64 : sidebarWidth;
          let next: number;
          if (event.key === "Home") next = 64;
          else if (event.key === "End") next = 320;
          else if (event.key === "ArrowLeft") next = Math.max(64, width - 16);
          else if (event.key === "ArrowRight") next = Math.min(320, collapsed ? 112 : width + 16);
          else return;
          event.preventDefault();
          setCollapsed(next <= 96);
          setSidebarWidth(next <= 96 ? 64 : next);
        }}
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
        className={`absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize focus-visible:outline-2 focus-visible:outline-[var(--theme-accent)] focus-visible:-outline-offset-2 ${resizingSidebar ? "bg-slate-400/20" : "hover:bg-slate-400/10"}`}
        style={{ touchAction: "none" }}
      />

    </div>
  );

  // The shell is pinned to the viewport (fixed inset-0) rather than sized with
  // h-dvh. 100dvh is the full viewport height and ignores space taken by a
  // horizontal scrollbar or fractional device-pixel rounding, so the shell could
  // end up marginally taller than the space actually available and give the
  // *document* its own scrollbar, on top of the one .app-shell-main already
  // owns — two scrollbars down the right-hand side. Anchoring to inset-0 makes
  // the shell exactly the viewport, so only the content area ever scrolls.
  return (
    <div
      data-theme={mode}
      data-appearance={appearance}
      className="app-shell-root fixed inset-0 flex overflow-hidden"
      style={{
        backgroundColor: "var(--app-canvas)",
        "--theme-light": light,
        "--theme-dark": darkColor,
        "--theme-accent": accent,
        ...themeVariables,
        ...chartVariables,
        ...(isLight && themePreset !== "grok" ? { "--app-canvas": light } : {}),
        "--app-sidebar-width": `${collapsed ? 64 : sidebarWidth}px`,
      } as React.CSSProperties}
    >
      {/* The provider sits INSIDE .app-shell-root on purpose: it renders the
          command menu and help sheet as <dialog>s, and although those paint in
          the top layer they still inherit CSS custom properties through the DOM.
          Mounted outside this element they would lose every theme token. */}
      <KeyboardProvider commands={APP_COMMANDS}>
      <a href="#main-content" className="ui-skip-link">
        Skip to content
      </a>

      <aside className="hidden lg:flex">{sidebar}</aside>

      {open && (
        <Modal onClose={() => setOpen(false)} label="Main navigation" className="ui-navigation-drawer">
          {/* Close floats at the top right instead of taking a row of its own (Tom, 2026-11-24: save space). */}
          <div className="relative">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute right-2 top-1.5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"><X size={20} /></button>
            <aside>{sidebar}</aside>
          </div>
        </Modal>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => {
              setCollapsed(false);
              setOpen(true);
            }}
            className="rounded p-2 text-slate-500 hover:bg-slate-100"
          >
            <Menu size={20} />
          </button>
          <span className="ml-auto" />
          <span className="pl-2">
            <PrivacyToggle on={privacy} compact />
          </span>
          <button
            type="button"
            aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={mode === "dark"}
            title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleDeviceTheme}
            className="ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            {mode === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="app-shell-main min-w-0 flex-1 overflow-y-auto"
          style={{ background: mainPanelBackground }}
        >
          {curtain ? (
            <>
              <div
                inert
                aria-hidden
                className="pointer-events-none select-none blur-xl"
                data-privacy-curtain
              >
                {children}
              </div>
              <div className="fixed inset-x-0 bottom-0 top-14 z-20 flex items-center justify-center p-6 lg:left-[var(--app-sidebar-width)] lg:top-0">
                <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
                  <EyeOff className="mx-auto text-violet-600" size={24} aria-hidden />
                  <h2 className="mt-3 text-base font-semibold text-slate-900">Privacy is on</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    This page can show client names, so it is blurred. Turn privacy off to use it.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <PrivacyToggle on label="Turn privacy off" />
                  </div>
                </div>
              </div>
            </>
          ) : (
            children
          )}
        </main>
      </div>
      </KeyboardProvider>
    </div>
  );
}
