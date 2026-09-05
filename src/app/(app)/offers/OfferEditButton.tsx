"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, TriangleAlert, X } from "lucide-react";
import { Modal } from "@/components/Modal";

type OfferEditButtonProps = {
  href: string;
  offerId: string;
  viewed: boolean;
  signed: boolean;
  paid: boolean;
  primary?: boolean;
};

export function OfferEditButton({ href, offerId, viewed, signed, paid, primary = false }: OfferEditButtonProps) {
  const [warningOpen, setWarningOpen] = useState(false);
  const hasProgress = viewed || signed || paid;
  const hasCommittedProgress = signed || paid;
  const dialogTitleId = `edit-offer-warning-title-${offerId}`;
  const iconButtonClass = `${primary ? "ui-action-primary" : "ui-action-secondary"} relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition`;

  if (!hasProgress) {
    return (
      <Link href={href} aria-label="Edit offer" title="Edit offer" className={iconButtonClass}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Edit offer — review warning"
        title="Edit offer — review warning"
        aria-haspopup="dialog"
        onClick={() => setWarningOpen(true)}
        className={iconButtonClass}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
        <span
          className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-800"
          aria-hidden="true"
        >
          <TriangleAlert className="h-2.5 w-2.5" />
        </span>
      </button>

      {warningOpen ? (
        <Modal onClose={() => setWarningOpen(false)} labelledBy={dialogTitleId} className="max-w-lg">
          <div className="p-5 text-left sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                  <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 id={dialogTitleId} className="text-lg font-semibold text-slate-900">
                  {hasCommittedProgress ? "Edit a signed or paid proposal?" : "Edit a viewed proposal?"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setWarningOpen(false)}
                aria-label="Close edit warning"
                className="ui-action-secondary inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-3 text-base leading-6 text-slate-600">
              Opening the editor changes only the working version. The proposal your client can see stays unchanged until you publish again.
            </p>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-base font-semibold text-amber-950">This proposal has progressed:</p>
              <ul className="mt-2 space-y-1 text-base text-amber-900">
                {viewed ? <li>• Viewed by the client</li> : null}
                {signed ? <li>• Contract signed</li> : null}
                {paid ? <li>• Payment recorded</li> : null}
              </ul>
            </div>

            <p className="mt-4 text-base leading-6 text-slate-600">
              {hasCommittedProgress
                ? "The signature and payment remain tied to the currently published terms. For material changes, duplicate this offer and issue a new proposal instead of replacing the signed version."
                : "If you publish changes, resend the proposal and follow up so the client knows a revised version is available."}
            </p>

            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => setWarningOpen(false)}
                className="ui-action-secondary inline-flex h-9 items-center justify-center rounded-full border px-4 text-base font-semibold transition"
              >
                Cancel
              </button>
              <Link
                href={href}
                className="ui-action-primary inline-flex h-9 items-center justify-center rounded-full border px-4 text-base font-semibold transition"
              >
                {hasCommittedProgress ? "Edit anyway" : "Continue to edit"}
              </Link>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
