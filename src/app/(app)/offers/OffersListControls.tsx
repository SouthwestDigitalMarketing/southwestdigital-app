"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpenText, Clock, GraduationCap, Share2, X, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/Modal";
import { OFFER_KINDS, whoHref, type OfferKindKey } from "@/lib/quotes/kinds";
import type { OfferStatusFilter } from "@/lib/quotes/status";

const OFFER_KIND_ICONS: Record<OfferKindKey, LucideIcon> = {
  bookkeeping: BookOpenText,
  consulting: Clock,
  coaching: GraduationCap,
  "referral-network": Share2,
};

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
  const [showCreateOffer, setShowCreateOffer] = useState(false);

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
    router.push(qs ? `/offers?${qs}` : "/offers", { scroll: false });
  }

  const selectClass =
    "rounded-full border border-slate-300 bg-transparent px-3 py-2 text-base text-slate-700 focus:border-slate-500 focus:outline-none";

  return (
    <div className="px-4 py-4 sm:px-5">
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
        <button
          type="button"
          onClick={() => setShowCreateOffer(true)}
          className="ui-action-primary ml-auto inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border px-4 py-2 text-base font-semibold transition"
        >
          Create offer
        </button>
      </div>

      {showCreateOffer ? (
        <Modal
          onClose={() => setShowCreateOffer(false)}
          labelledBy="create-offer-dialog-title"
          describedBy="create-offer-dialog-description"
          className="max-w-xl"
        >
          <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="create-offer-dialog-title" className="text-xl font-semibold text-slate-900">
                      Choose a service type
                    </h2>
                    <p id="create-offer-dialog-description" className="mt-1 text-sm text-slate-500">
                      Select the kind of offer you want to create.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close service type chooser"
                    title="Close service type chooser"
                    onClick={() => setShowCreateOffer(false)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 grid gap-3">
                  {OFFER_KINDS.map((kind, index) => {
                    const Icon = OFFER_KIND_ICONS[kind.key];
                    return (
                      <Link
                        key={kind.key}
                        href={whoHref(kind.key, contactId)}
                        autoFocus={index === 0}
                        onClick={() => setShowCreateOffer(false)}
                        className="theme-dark block rounded-xl border px-4 py-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <span className="flex items-center gap-2 font-semibold">
                          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          {kind.name}
                        </span>
                        <span className="mt-1 block text-sm opacity-80">{kind.summary}</span>
                      </Link>
                    );
                  })}
                </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
