"use client";

import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function SendOfferEmailButton({
  offerId,
  disabled = false,
}: {
  offerId: string;
  disabled?: boolean;
}) {
  const router = useRouter();

  return (
    <span className="inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={() => router.push(`/offers/cover?offer=${encodeURIComponent(offerId)}`)}
        className={
          disabled
            ? "inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full border border-slate-200 text-slate-300"
            : "ui-action-secondary inline-flex h-9 w-9 items-center justify-center rounded-full border transition"
        }
        aria-label="Send offer email"
        title={disabled ? "Finish the draft before sending" : "Send offer email"}
      >
        <Send className="h-4 w-4" />
      </button>
    </span>
  );
}
