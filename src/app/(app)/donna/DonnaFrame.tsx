import Link from "next/link";
import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { requireDonna } from "@/lib/donna/access";
import { loadDonnaAction, storageMissing } from "@/lib/donna/store";
import { RefreshDonna } from "./refresh";
import { DonnaAction } from "./DonnaAction";

export function DonnaFrame({
  active,
  children,
  live = true,
  refreshEvery,
}: {
  active: "overview" | "current" | "jobs" | "email";
  children: ReactNode;
  live?: boolean;
  /** Milliseconds between refreshes; the Current job page refreshes fast. */
  refreshEvery?: number;
}) {
  return (
    <div className="w-full min-w-0 break-words space-y-4 px-4 py-5 text-slate-900 sm:p-8">
      {live ? <RefreshDonna every={refreshEvery} /> : null}
      <h1 className="sr-only">Donna</h1>
      <div className="flex items-center gap-6 border-b border-slate-200">
        <nav
          aria-label="Donna sections"
          className="flex min-w-0 gap-4 overflow-x-auto whitespace-nowrap sm:gap-6"
        >
          {[
            { label: "Overview", href: "/donna", key: "overview" },
            { label: "Current job", href: "/donna/current", key: "current" },
            { label: "Completed jobs", href: "/donna/jobs", key: "jobs" },
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

/**
 * Start new job (Tom, 2026-11-26): the button that opens Donna's job list, shown
 * on the Current job tab only while no job is running.
 */
export async function DonnaStart() {
  let action;
  try {
    const { dataContext } = await requireDonna();
    action = await loadDonnaAction(dataContext);
  } catch (e) {
    if (!storageMissing(e)) throw e;
    return null;
  }
  if (!action.mailboxId) return null;
  return (
    <DonnaAction
      mailboxId={action.mailboxId}
      cleaning={action.cleaning}
      cleanJobId={action.cleanJobId}
      counts={action.counts}
    />
  );
}
