"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOfferStatusAction } from "./actions";
import type { OfferBucket } from "@/lib/quotes/status";

export function OfferStatusButtons({
  offerId,
  status,
  bucket,
}: {
  offerId: string;
  status: string;
  bucket: OfferBucket;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(next: "draft" | "completed" | "archived" | "sent" | "accepted" | "rejected") {
    const data = new FormData();
    data.set("id", offerId);
    data.set("status", next);
    startTransition(async () => {
      await setOfferStatusAction(data);
      router.refresh();
    });
  }

  const btn =
    "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-50";

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {bucket === "draft" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("sent")}
            className={`${btn} border-slate-300 text-slate-700 hover:bg-slate-50`}
          >
            Mark sent
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("archived")}
            className={`${btn} border-slate-300 text-slate-700 hover:bg-slate-50`}
          >
            Archive
          </button>
        </>
      ) : null}
      {bucket === "completed" && status === "sent" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("accepted")}
            className={`${btn} border-slate-300 text-slate-700 hover:bg-slate-50`}
          >
            Accepted
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("rejected")}
            className={`${btn} border-slate-300 text-slate-700 hover:bg-slate-50`}
          >
            Rejected
          </button>
        </>
      ) : null}
      {bucket === "completed" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("archived")}
          className={`${btn} border-slate-300 text-slate-700 hover:bg-slate-50`}
        >
          Archive
        </button>
      ) : null}
      {bucket === "archived" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("draft")}
          className={`${btn} border-slate-300 text-slate-700 hover:bg-slate-50`}
        >
          Restore
        </button>
      ) : null}
    </div>
  );
}
