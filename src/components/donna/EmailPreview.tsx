"use client";

import { useId, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/Modal";

/**
 * Tap a subject (or a spam sender) to read the email in a pop-up (Tom, 2026-11-28).
 * Shows the start of the text Donna saved when she sorted: plain text, links not
 * clickable (much of it is spam). Jobs sorted before this have no text: plain label.
 */
export function EmailPreview({
  children,
  subject,
  from,
  at,
  body,
}: {
  children: ReactNode;
  subject: string;
  from: string;
  at?: string;
  body: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  if (!body) return <>{children}</>;
  const when = at ? new Date(at) : null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="max-w-full text-left underline decoration-slate-300 underline-offset-2 hover:decoration-current"
        aria-label={`Read ${subject}`}
      >
        {children}
      </button>
      {open ? (
        <Modal
          onClose={() => setOpen(false)}
          labelledBy={titleId}
          className="max-w-2xl"
        >
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col bg-[var(--surface)] text-[color:var(--text-primary)]">
            <div className="flex items-start gap-3 border-b border-[color:var(--border)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  className="break-words text-base font-semibold"
                >
                  {subject}
                </h2>
                <p className="mt-0.5 break-words text-xs text-[color:var(--text-muted)]">
                  {from}
                  {when && !Number.isNaN(when.getTime())
                    ? ` · ${when.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded-full p-2 text-[color:var(--text-muted)] hover:bg-[var(--surface-control)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 text-sm leading-relaxed">
              {body}
            </div>
            <p className="border-t border-[color:var(--border)] px-4 py-2 text-xs text-[color:var(--text-muted)]">
              {body.endsWith("…") ? "The start of the email only. " : ""}
              Links are shown as text, so nothing here can be clicked by
              mistake.
            </p>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
