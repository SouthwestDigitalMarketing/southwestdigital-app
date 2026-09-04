"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
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
  const [pending, startTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  function setStatus(next: "draft" | "completed" | "archived" | "sent" | "accepted" | "rejected") {
    const data = new FormData();
    data.set("id", offerId);
    data.set("status", next);
    startTransition(async () => {
      await setOfferStatusAction(data);
      router.refresh();
    });
  }

  function requestDelete() {
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
    "ui-action-secondary inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-50";

  return (
    <div className="flex flex-wrap justify-end gap-1">
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
        </button>
      ) : null}
      {bucket === "sent" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("accepted")}
            className="ui-action-ghost inline-flex h-9 items-center justify-center rounded-full px-3 text-base font-medium leading-none transition disabled:opacity-50"
          >
            Accepted
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("rejected")}
            className="ui-action-ghost inline-flex h-9 items-center justify-center rounded-full px-3 text-base font-medium leading-none transition disabled:opacity-50"
          >
            Rejected
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
      </button>
      {deleteConfirmOpen ? (
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
        </div>
      ) : null}
    </div>
  );
}
