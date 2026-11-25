import Link from "next/link";
import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { RefreshDonna } from "./refresh";

export function DonnaFrame({
  active,
  children,
  live = true,
}: {
  active: "overview" | "email";
  children: ReactNode;
  live?: boolean;
}) {
  return (
    <div className="w-full min-w-0 break-words space-y-4 px-4 py-5 text-slate-900 sm:p-8">
      {live ? <RefreshDonna /> : null}
      <h1 className="sr-only">Donna</h1>
      <div className="flex items-center gap-6 border-b border-slate-200">
        <nav aria-label="Donna sections" className="flex gap-6">
          {[
            { label: "Overview", href: "/donna", key: "overview" },
            { label: "Email", href: "/donna/email", key: "email" },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active === t.key ? "page" : undefined}
              className={`border-b-2 px-1 pb-3 pt-1 text-sm font-medium ${active === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/donna/settings"
          aria-label="Donna settings"
          className="-mr-2 ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <Settings size={18} />
        </Link>
      </div>
      {children}
    </div>
  );
}

export function shortTime(date: Date | null) {
  return date
    ? date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      })
    : "Not checked yet";
}
