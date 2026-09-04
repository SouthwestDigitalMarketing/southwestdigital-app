"use client";

import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function SendOfferEmailButton({
  offerId,
}: {
  offerId: string;
}) {
  const router = useRouter();

  return (
    <span className="inline-flex">
      <button
        type="button"
        onClick={() => router.push(`/offers/cover?offer=${encodeURIComponent(offerId)}`)}
        className="ui-action-secondary inline-flex h-9 w-9 items-center justify-center rounded-full border transition"
        aria-label="Send offer email"
        title="Send offer email"
      >
        <Send className="h-4 w-4" />
      </button>
    </span>
  );
}
