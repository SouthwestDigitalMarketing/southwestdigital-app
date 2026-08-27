"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { archiveContactAction, deleteContactAction } from "./actions";

const ghost =
  "rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const danger =
  "rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-50 disabled:opacity-50";
const primary =
  "rounded-full bg-slate-900 px-2.5 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-white hover:bg-slate-700";

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
