"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOfferStatusAction } from "./actions";
import type { OfferBucket } from "@/lib/quotes/status";

export function OfferStatusButtons({
  offerId,
  bucket,
}: {
  offerId: string;
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
    "ui-action-ghost inline-flex h-9 items-center justify-center rounded-full px-3 text-base font-medium leading-none transition disabled:opacity-50";

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {bucket === "draft" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("sent")}
            className={btn}
          >
            Mark sent
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("archived")}
            className={btn}
          >
            Archive
          </button>
        </>
      ) : null}
      {bucket === "sent" ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("accepted")}
            className={btn}
          >
            Accepted
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("rejected")}
            className={btn}
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
          className={btn}
        >
          Archive
        </button>
      ) : null}
      {bucket === "archived" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("draft")}
          className={btn}
        >
          Unarchive
        </button>
      ) : null}
    </div>
  );
}
