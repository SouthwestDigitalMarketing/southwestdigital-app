"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Send } from "lucide-react";
import { resendQuoteAction } from "./actions";

type FollowUpKind = "unviewed" | "unsigned" | "unpaid";

export function SendOfferEmailButton({
  offerId,
  hasBeenSent,
  disabled = false,
  primary = false,
  primaryLabel,
  followUpKind,
}: {
  offerId: string;
  hasBeenSent: boolean;
  disabled?: boolean;
  primary?: boolean;
  primaryLabel?: string;
  followUpKind?: FollowUpKind;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function sendOrResend() {
    // Primary/nudge mode always opens the compose flow so staff can
    // personalize the follow-up copy before sending. The template is
    // preselected based on the follow-up kind (unviewed/unsigned/unpaid).
    if (primary && followUpKind) {
      router.push(`/offers/cover?offer=${encodeURIComponent(offerId)}&followUp=${followUpKind}`);
      return;
    }
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

  const defaultLabel = hasBeenSent ? "Resend offer" : "Send offer email";
  const label = primary && primaryLabel ? primaryLabel : defaultLabel;
  const variantClass = primary ? "ui-action-primary" : "ui-action-secondary";

  return (
    <span className="inline-flex">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={sendOrResend}
        className={
          disabled
            ? "inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full border border-slate-200 text-slate-300"
            : `${variantClass} inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:opacity-50`
        }
        aria-label={label}
        title={disabled ? "Finish the draft before sending" : label}
      >
        {hasBeenSent ? <RotateCw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
      </button>
    </span>
  );
}
