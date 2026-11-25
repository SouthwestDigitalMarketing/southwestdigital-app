"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { startCleanInbox } from "./actions";
import { Modal } from "@/components/Modal";
import type { DonnaActionCounts } from "@/lib/donna/domain";

const idleAction =
  "flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-400";

function Count({ value }: { value: number }) {
  return <span className="tabular-nums">{value.toLocaleString("en-US")}</span>;
}

export function DonnaAction({
  mailboxId,
  cleaning,
  counts,
}: {
  mailboxId: string;
  cleaning: boolean;
  counts: DonnaActionCounts;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cleaningInbox = pending || cleaning;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm text-white sm:w-auto"
      >
        Donna
      </button>

      {open && (
        <Modal
          onClose={() => setOpen(false)}
          label="Donna"
          className="max-w-md"
          busy={pending}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Close"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-2 space-y-2">
              <button
                type="button"
                disabled={cleaningInbox}
                onClick={() => {
                  setError(null);
                  const data = new FormData();
                  data.set("mailboxId", mailboxId);
                  startTransition(async () => {
                    const result = await startCleanInbox(data);
                    if (!result.ok) {
                      setError(result.message);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  });
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white disabled:opacity-60"
              >
                <span>{cleaningInbox ? "Cleaning…" : "Clean inbox"}</span>
                <Count value={counts.inbox} />
              </button>
              <button type="button" disabled className={idleAction}>
                <span>Empty spam</span>
                <Count value={counts.spam} />
              </button>
              <button type="button" disabled className={idleAction}>
                <span>Clear notifications</span>
                <Count value={counts.notifications} />
              </button>
              <button type="button" disabled className={idleAction}>
                <span>Empty trash</span>
                <Count value={counts.trash} />
              </button>
              <button type="button" disabled className={idleAction}>
                <span>Clean drafts</span>
                <Count value={counts.drafts} />
              </button>
            </div>
            <button
              type="button"
              disabled
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-400"
            >
              <span>Do it all</span>
              <Count value={counts.all} />
            </button>
            {error ? (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </p>
            ) : null}
          </div>
        </Modal>
      )}
    </>
  );
}
