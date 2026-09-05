"use client";

import { useId, useRef, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";
import type { AssessmentState } from "./ProposalCreationWorkspaceDemo";

export default function AssessmentCardSection({
  title,
  summary,
  children,
  assessment,
  onCancel,
  readOnly = false,
  footer,
}: {
  title: string;
  summary?: Array<[string, string]>;
  children: ReactNode;
  assessment: AssessmentState;
  onCancel: (assessment: AssessmentState) => void;
  readOnly?: boolean;
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const originalRef = useRef(assessment);
  const titleId = useId();

  function cancel() {
    onCancel(originalRef.current);
    dialogRef.current?.close();
  }

  return (
    <div className="proposal-assessment-section border-b border-slate-200 px-5 py-6 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {!readOnly ? (
          <button
            type="button"
            aria-label={`Edit ${title}`}
            aria-haspopup="dialog"
            onClick={() => {
              originalRef.current = assessment;
              dialogRef.current?.showModal();
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-base font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
          </button>
        ) : null}
      </div>
      <div className="mt-4">
        {readOnly ? children : (
          <div className={`grid gap-x-6 gap-y-4 sm:grid-cols-2 ${summary && summary.length >= 3 ? "xl:grid-cols-3" : ""}`}>
            {summary?.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
                <p className="mt-1 whitespace-pre-line break-words text-base font-medium text-slate-800">{value || "Not set"}</p>
              </div>
            ))}
          </div>
        )}
        {footer}
      </div>
      {!readOnly ? (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          onCancel={cancel}
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
            <h2 id={titleId} className="text-xl font-semibold">Edit {title}</h2>
            <button type="button" onClick={cancel} aria-label="Close editor" className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-slate-100">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-5 px-6 py-6">{children}</div>
          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <button type="button" onClick={cancel} className="rounded-lg px-4 py-2 text-base font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={() => dialogRef.current?.close()} className="ui-action-primary rounded-lg px-4 py-2 text-base font-semibold">Save changes</button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
