"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { archiveContactAction, deleteContactAction } from "./actions";

// Colour, hover and keyboard focus come from the shared action tokens; only
// shape and type stay local. The tokens are what carry the :focus-visible ring.
const ghost =
  "ui-action-ghost rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-50";
const danger =
  "ui-action-danger rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-50";
const primary =
  "ui-action-primary rounded-full px-2.5 py-1 text-center text-[11px] font-semibold uppercase tracking-wide";

export function ContactActions({
  contactId,
  isActive,
  compact = false,
}: {
  contactId: string;
  isActive: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function archive() {
    const data = new FormData();
    data.set("contactId", contactId);
    data.set("archived", isActive ? "1" : "0");
    startTransition(async () => {
      await archiveContactAction(data);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Delete this contact permanently? This cannot be undone.")) return;
    const data = new FormData();
    data.set("contactId", contactId);
    startTransition(async () => {
      await deleteContactAction(data);
    });
  }

  if (compact) {
    return (
      <div className="flex flex-nowrap items-center gap-1">
        <Link href={`/contacts/${contactId}`} className={`${ghost} shrink-0`}>
          Edit
        </Link>
        <button type="button" disabled={pending} onClick={archive} className={`${ghost} shrink-0`}>
          {isActive ? "Archive" : "Restore"}
        </button>
        <button type="button" disabled={pending} onClick={remove} className={`${danger} shrink-0`}>
          Delete
        </button>
        <Link href={`/offers?contact=${contactId}`} className={`${primary} shrink-0`}>
          Build Offer
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/offers?contact=${contactId}`} className={`${primary} px-4 py-2 text-xs`}>
        Build Offer
      </Link>
      <button type="button" disabled={pending} onClick={archive} className={`${ghost} px-4 py-2 text-xs`}>
        {isActive ? "Archive" : "Restore"}
      </button>
      <button type="button" disabled={pending} onClick={remove} className={`${danger} px-4 py-2 text-xs`}>
        Delete
      </button>
    </div>
  );
}
