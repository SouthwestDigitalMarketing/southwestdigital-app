"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SectionTab = {
  label: string;
  href: string;
  exact?: boolean;
  /** Other path prefixes that belong to this tab (Series also covers /showrunner/new-series). */
  also?: string[];
};

function underPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isActive(pathname: string, tab: SectionTab) {
  if (tab.also?.some((href) => underPath(pathname, href))) return true;
  return tab.exact ? pathname === tab.href : underPath(pathname, tab.href);
}

/** The tab row across the top of a menu section (Showrunner: Overview · Videos · New video · Series). Scrolls sideways on a phone. */
export function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="border-b border-[var(--border)] px-4 sm:px-8">
      <ul className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`block border-b-2 py-3 text-sm font-semibold ${
                  active
                    ? "border-[var(--theme-accent)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
