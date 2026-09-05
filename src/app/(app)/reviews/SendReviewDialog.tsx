"use client";

import { useRef, useState, useTransition } from "react";
import { Send, X } from "lucide-react";
import { sendReviewRequest } from "./actions";
import { Modal } from "@/components/Modal";

export function SendReviewDialog({ onSent }: { onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await sendReviewRequest(data);
        formRef.current?.reset();
        setOpen(false);
        onSent();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ui-action-primary flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition"
      >
        <Send size={13} />
        Send Review Request
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} labelledBy="send-review-title" className="max-w-md" busy={pending}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="send-review-title" className="text-xl font-semibold tracking-tight text-slate-900">Request a review</h2>
              <button
                type="button"
                aria-label="Close review request"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="review-recipient-name" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Recipient name
                </label>
                <input
                  name="recipientName"
                  id="review-recipient-name"
                  type="text"
                  required
                  placeholder="Jane Smith"
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="review-recipient-phone" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Phone number
                </label>
                <input
                  name="recipientPhone"
                  id="review-recipient-phone"
                  type="tel"
                  required
                  placeholder="(555) 123-4567"
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>

              {error && (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="ui-action-primary flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition disabled:opacity-50"
                >
                  <Send size={13} />
                  {pending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
