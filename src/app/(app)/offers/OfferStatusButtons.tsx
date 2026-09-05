"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Ellipsis, Trash2 } from "lucide-react";
import { deleteQuoteAction, setOfferStatusAction } from "./actions";
import type { OfferBucket } from "@/lib/quotes/status";

export function OfferStatusButtons({
  offerId,
  bucket,
  children,
}: {
  offerId: string;
  bucket: OfferBucket;
  children: ReactNode;
}) {
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dialogTarget, setDialogTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const close = () => popoverRef.current?.hidePopover();
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [moreOpen]);

  function setStatus(next: "draft" | "completed" | "archived" | "sent" | "accepted" | "rejected") {
    const data = new FormData();
    data.set("id", offerId);
    data.set("status", next);
    startTransition(async () => {
      await setOfferStatusAction(data);
      router.refresh();
    });
  }

  function requestDelete(event: React.MouseEvent<HTMLButtonElement>) {
    setDialogTarget((event.currentTarget.closest("[data-theme]") as HTMLElement | null) ?? document.body);
    setDeleteConfirmOpen(true);
  }

  function deleteOffer() {
    setDeleteConfirmOpen(false);
    const data = new FormData();
    data.set("id", offerId);
    startTransition(async () => {
      await deleteQuoteAction(data);
      router.refresh();
    });
  }

  const iconBtn =
    "flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 focus-visible:outline-2 disabled:opacity-50";

  return (
    <div className="shrink-0">
      <button
        type="button"
        popoverTarget={`offer-more-${offerId}`}
        aria-label="More offer actions"
        title="More offer actions"
        className="ui-action-secondary inline-flex h-9 w-9 items-center justify-center rounded-full border transition"
        onClick={(event) => {
          const panel = popoverRef.current;
          if (!panel) return;
          const rect = event.currentTarget.getBoundingClientRect();
          panel.style.left = `${Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232))}px`;
          const below = window.innerHeight - rect.bottom;
          const openBelow = below >= 320 || below >= rect.top;
          panel.style.top = openBelow ? `${rect.bottom + 4}px` : "auto";
          panel.style.bottom = openBelow ? "auto" : `${window.innerHeight - rect.top + 4}px`;
          panel.style.maxHeight = `${Math.max(0, (openBelow ? below : rect.top) - 12)}px`;
        }}
      >
        <Ellipsis className="h-4 w-4" aria-hidden="true" />
      </button>
      <div
        id={`offer-more-${offerId}`}
        ref={popoverRef}
        popover="auto"
        onToggle={(event) => setMoreOpen(event.newState === "open")}
        aria-label="More offer actions"
        className="fixed m-0 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 text-sm text-slate-700 shadow-xl"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a")) popoverRef.current?.hidePopover();
        }}
      >
      {children}
      {bucket === "draft" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("archived")}
          className={iconBtn}
          aria-label="Archive offer"
          title="Archive offer"
        >
          <Archive className="h-4 w-4" />
          Archive offer
        </button>
      ) : null}
      {bucket === "sent" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("accepted")}
            className={iconBtn}
          >
            Mark accepted
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("rejected")}
            className={iconBtn}
          >
            Mark rejected
          </button>
        </>
      ) : null}
      {bucket === "completed" || bucket === "sent" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("archived")}
          className={iconBtn}
          aria-label="Archive offer"
          title="Archive offer"
        >
          <Archive className="h-4 w-4" />
          Archive offer
        </button>
      ) : null}
      {bucket === "archived" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("draft")}
          className={iconBtn}
          aria-label="Unarchive offer"
          title="Unarchive offer"
        >
          <ArchiveRestore className="h-4 w-4" />
          Unarchive offer
        </button>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={requestDelete}
        className={iconBtn}
        aria-label="Delete offer permanently"
        title="Delete offer permanently"
      >
        <Trash2 className="h-4 w-4" />
        Delete offer
      </button>
      </div>
      {deleteConfirmOpen && dialogTarget ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"
          role="presentation"
          onClick={() => !pending && setDeleteConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-offer-title-${offerId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={`delete-offer-title-${offerId}`} className="text-lg font-semibold text-slate-900">
              Delete this offer?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This permanently deletes the offer and cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setDeleteConfirmOpen(false)}
                className="ui-action-secondary inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={deleteOffer}
                className="inline-flex h-9 items-center justify-center rounded-full border border-rose-600 bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {pending ? "Deleting..." : "Delete offer"}
              </button>
            </div>
          </div>
        </div>,
        dialogTarget,
      ) : null}
    </div>
  );
}
