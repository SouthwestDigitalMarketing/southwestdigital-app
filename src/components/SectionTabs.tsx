"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode, type TouchEvent } from "react";

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

/** The tab row across the top of a menu section. Scrolls sideways on a phone and keeps the current tab in view. */
export function SectionTabs({ tabs, label }: { tabs: SectionTab[]; label: string }) {
  const pathname = usePathname();
  const row = useRef<HTMLUListElement>(null);
  // Keep the current tab in view when the row is wider than the phone.
  useEffect(() => {
    row.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <nav aria-label={label} className="border-b border-[var(--border)] px-4 sm:px-8">
      <ul ref={row} className="-mb-px flex gap-6 overflow-x-auto [scrollbar-width:none]">
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

const SWIPE_MIN_PX = 70;
const SWIPE_MAX_MS = 800;

/** True when the touch began on something that scrolls sideways itself (calendar strip, tables) or is a field. */
function ownsHorizontalSwipe(target: EventTarget | null, stop: HTMLElement | null) {
  for (let el = target instanceof HTMLElement ? target : null; el && el !== stop; el = el.parentElement) {
    if (el.dataset.noSwipe !== undefined || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
    const overflow = getComputedStyle(el).overflowX;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

/**
 * Swipe left or right on the page to move to the next or previous tab (Tom, 2026-11-24). Elements that scroll
 * sideways keep their own swipe; mark anything else with data-no-swipe.
 */
export function SwipeBetweenTabs({ tabs, children }: { tabs: SectionTab[]; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const index = tabs.findIndex((tab) => isActive(pathname, tab));

  useEffect(() => {
    for (const neighbour of [tabs[index - 1], tabs[index + 1]]) if (neighbour) router.prefetch(neighbour.href);
  }, [index, tabs, router]);

  // A sideways swipe must not also trigger the browser's own swipe-back.
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overscrollBehaviorX;
    root.style.overscrollBehaviorX = "none";
    return () => {
      root.style.overscrollBehaviorX = before;
    };
  }, []);

  function onTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    start.current = event.touches.length === 1 && !ownsHorizontalSwipe(event.target, box.current)
      ? { x: touch.clientX, y: touch.clientY, t: event.timeStamp }
      : null;
  }

  function onTouchEnd(event: TouchEvent) {
    const from = start.current;
    start.current = null;
    if (!from || index < 0) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy) || event.timeStamp - from.t > SWIPE_MAX_MS) return;
    const next = tabs[index + (dx < 0 ? 1 : -1)];
    // Replace, not push: tabs are one place, so Back leaves the section instead of replaying swipes.
    if (next) router.replace(next.href);
  }

  return (
    // Fills the screen so a swipe below short content still counts.
    <div ref={box} className="min-h-[calc(100dvh-7rem)]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => (start.current = null)}>
      {children}
    </div>
  );
}
