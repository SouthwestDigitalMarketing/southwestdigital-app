"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { OFFER_KINDS, whoHref } from "@/lib/quotes/kinds";
import type { OfferStatusFilter } from "@/lib/quotes/status";

export function OffersListControls({
  archived,
  statusFilter,
  kindFilter,
  contactId,
}: {
  archived: boolean;
  statusFilter: OfferStatusFilter;
  kindFilter: string;
  contactId?: string;
}) {
  const router = useRouter();

  function push(next: { archived?: boolean; status?: string; kind?: string }) {
    const params = new URLSearchParams();
    const nextArchived = next.archived ?? archived;
    const nextStatus = next.status ?? statusFilter;
    const nextKind = next.kind ?? kindFilter;
    if (contactId) params.set("contact", contactId);
    if (nextArchived) params.set("archived", "1");
    else if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextKind !== "all") params.set("kind", nextKind);
    const qs = params.toString();
    router.push(qs ? `/offers?${qs}` : "/offers");
  }

  const selectClass =
    "rounded-full border border-slate-300 bg-transparent px-3 py-2 text-base text-slate-700 focus:border-slate-500 focus:outline-none";

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-base text-slate-500">
          Type
          <select
            className={selectClass}
            value={kindFilter}
            onChange={(event) => push({ kind: event.target.value })}
          >
            <option value="all">All</option>
            {OFFER_KINDS.map((kind) => (
              <option key={kind.key} value={kind.key}>
                {kind.name}
              </option>
            ))}
          </select>
        </label>
        {archived ? null : (
          <label className="flex items-center gap-2 text-base text-slate-500">
            Status
            <select
              className={selectClass}
              value={statusFilter}
              onChange={(event) => push({ status: event.target.value })}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        )}
        <div className="flex items-center gap-3 text-base font-medium">
          <span className={archived ? "text-slate-400" : "text-slate-900"}>Current</span>
          <button
            type="button"
            role="switch"
            aria-checked={archived}
            aria-label="Show archived offers"
            onClick={() => push({ archived: !archived, status: "all" })}
            className="ui-toggle-switch"
          >
            <span className="ui-toggle-switch-thumb" />
          </button>
          <span className={archived ? "text-slate-900" : "text-slate-400"}>Archived</span>
        </div>
        <Link
          href={whoHref("bookkeeping", contactId)}
          className="ml-auto inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-base font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ backgroundColor: "var(--brand-dark, var(--brand-light))" }}
        >
          Create offer
        </Link>
      </div>
    </div>
  );
}
