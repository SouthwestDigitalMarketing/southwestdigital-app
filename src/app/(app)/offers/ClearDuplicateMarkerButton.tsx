"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { clearDuplicateMarkerAction } from "./actions";

export function ClearDuplicateMarkerButton({ offerId }: { offerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function clear() {
    const formData = new FormData();
    formData.set("id", offerId);
    startTransition(async () => {
      await clearDuplicateMarkerAction(formData);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      aria-label="Clear duplicate marker"
      title="Clear duplicate marker"
      disabled={pending}
      onClick={clear}
      className="ml-0.5 inline-flex h-3 w-3 items-center justify-center rounded-full text-amber-800 hover:bg-amber-200 disabled:opacity-50"
    >
      <X className="h-2.5 w-2.5" strokeWidth={3} />
    </button>
  );
}
