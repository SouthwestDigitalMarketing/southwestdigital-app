"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCw } from "lucide-react";
import { setOfferStatusAction } from "./actions";
import { resendQuoteAction } from "./actions";
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

  function resend() {
    const data = new FormData();
    data.set("id", offerId);
    startTransition(async () => {
      await resendQuoteAction(data);
      router.refresh();
    });
  }

  const iconBtn =
    "ui-action-ghost inline-flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-50";
  const canResend = bucket === "sent" || bucket === "completed";

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <button
        type="button"
        disabled={pending || !canResend}
        onClick={resend}
        className={iconBtn}
        aria-label="Resend offer"
        title="Resend offer"
      >
        <RotateCw className="h-4 w-4" />
      </button>
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
          className="ui-action-ghost inline-flex h-9 items-center justify-center rounded-full px-3 text-base font-medium leading-none transition disabled:opacity-50"
        >
          Unarchive
        </button>
      ) : null}
    </div>
  );
}
