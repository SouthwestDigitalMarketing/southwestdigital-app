"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Send } from "lucide-react";
import { resendQuoteAction } from "./actions";

export function SendOfferEmailButton({
  offerId,
  hasBeenSent,
  disabled = false,
}: {
  offerId: string;
  hasBeenSent: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function sendOrResend() {
    if (!hasBeenSent) {
      router.push(`/offers/cover?offer=${encodeURIComponent(offerId)}`);
      return;
    }

    const data = new FormData();
    data.set("id", offerId);
    startTransition(async () => {
      await resendQuoteAction(data);
      router.refresh();
    });
  }

  const label = hasBeenSent ? "Resend offer" : "Send offer email";

  return (
    <span className="inline-flex">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={sendOrResend}
        className={
          disabled
            ? "inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full border border-slate-200 text-slate-300"
            : "ui-action-secondary inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-50"
        }
        aria-label={label}
        title={disabled ? "Finish the draft before sending" : label}
      >
        {hasBeenSent ? <RotateCw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
      </button>
    </span>
  );
}
