"use client";

import Link from "next/link";
import { Archive, Ban, Eye, FileSignature, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveAgreementAction, batchAgreementAction, deleteAgreementAction, voidAgreementAction } from "./actions";

type IssuedAgreement = {
  id: string;
  clientName: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  agreementText: string | null;
  agreementSentAt: Date | null;
  signedAt: Date | null;
  signerName: string | null;
  agreementManagerStatus: "ACTIVE" | "VOIDED" | "VOIDED_BEFORE_SIGNATURE" | "CANCELLATION_REQUESTED" | "TERMINATED_AFTER_SIGNATURE" | "ARCHIVED";
  agreementCancellationRequestedAt: Date | null;
  agreementCancellationReason: string | null;
  onboardingFeeStatus: string;
  createdAt: Date;
  quotes: Array<{ id: string }>;
};

const STATUS_STYLES = {
  Issued: "bg-blue-50 text-blue-700",
  Sent: "bg-amber-50 text-amber-700",
  Signed: "bg-emerald-50 text-emerald-700",
  Voided: "bg-red-50 text-red-700",
  "Cancellation requested": "bg-amber-50 text-amber-700",
  Terminated: "bg-red-50 text-red-700",
  Archived: "bg-slate-100 text-slate-600",
} as const;

function agreementStatus(agreement: IssuedAgreement) {
  if (agreement.agreementManagerStatus === "VOIDED" || agreement.agreementManagerStatus === "VOIDED_BEFORE_SIGNATURE") return "Voided" as const;
  if (agreement.agreementManagerStatus === "CANCELLATION_REQUESTED") return "Cancellation requested" as const;
  if (agreement.agreementManagerStatus === "TERMINATED_AFTER_SIGNATURE") return "Terminated" as const;
  if (agreement.agreementManagerStatus === "ARCHIVED") return "Archived" as const;
  if (agreement.signedAt) return "Signed" as const;
  if (agreement.agreementSentAt) return "Sent" as const;
  return "Issued" as const;
}

function paymentStatus(status: string) {
  switch (status) {
    case "PAID":
      return "Paid";
    case "WAIVED":
      return "Waived";
    case "REQUIRED":
    case "INVOICED":
      return "Payment due";
    case "NOT_REQUIRED":
    case "INCLUDED_IN_PROJECT_FEE":
      return "Included";
    default:
      return "—";
  }
}

function formatDate(date: Date | null) {
  return date
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
}

export function IssuedAgreementsTable({ agreements }: { agreements: IssuedAgreement[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<{
    ids: string[];
    action: "void" | "requestCancellation" | "archive" | "delete";
    label: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const signedCount = agreements.filter((agreement) => agreement.signedAt).length;
  const awaitingSignatureCount = agreements.length - signedCount;
  const allSelected = agreements.length > 0 && selectedIds.size === agreements.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(agreements.map((agreement) => agreement.id)));
  }

  function toggleAgreement(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmAction() {
    if (!confirmation) return;
    const { ids, action } = confirmation;
    setActionError(null);
    startTransition(async () => {
      try {
        if (action === "requestCancellation") {
          await batchAgreementAction(ids, action, cancellationReason);
        } else if (ids.length === 1) {
          if (action === "void") await voidAgreementAction(ids[0]);
          if (action === "archive") await archiveAgreementAction(ids[0]);
          if (action === "delete") await deleteAgreementAction(ids[0]);
        } else {
          await batchAgreementAction(ids, action);
        }
        setConfirmation(null);
        router.refresh();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Something went wrong.");
      }
    });
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Agreements manager</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track agreements issued to clients and the signatures you have received.
          </p>
        </div>
        <div className="flex gap-5 text-right text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{agreements.length}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed</p>
            <p className="mt-1 text-xl font-semibold text-emerald-700">{signedCount}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Awaiting</p>
            <p className="mt-1 text-xl font-semibold text-amber-700">{awaitingSignatureCount}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-700">
              {selectedIds.size} {selectedIds.size === 1 ? "agreement" : "agreements"} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setConfirmation({ ids: [...selectedIds], action: "void", label: "void" })} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Void</button>
              <button type="button" onClick={() => { setCancellationReason(""); setConfirmation({ ids: [...selectedIds], action: "requestCancellation", label: "request cancellation" }); }} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50">Request cancellation</button>
              <button type="button" onClick={() => setConfirmation({ ids: [...selectedIds], action: "archive", label: "archive" })} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Archive</button>
              <button type="button" onClick={() => setConfirmation({ ids: [...selectedIds], action: "delete", label: "delete" })} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>
            </div>
          </div>
        ) : null}
        {agreements.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <FileSignature className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-sm text-slate-500">No issued agreements yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="w-12 px-5 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={allSelected ? "Deselect all agreements" : "Select all agreements"}
                      className="theme-checkbox h-4 w-4 rounded border-slate-300 focus:ring-slate-400"
                    />
                  </th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Agreement</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Client</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Issued</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Signed</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Status</th>
                  <th className="px-5 py-3 font-semibold text-slate-700">Payment</th>
                  <th className="px-5 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agreements.map((agreement) => {
                  const status = agreementStatus(agreement);
                  const contact = agreement.primaryContactName || agreement.primaryContactEmail;
                  const offer = agreement.quotes[0];

                  return (
                    <tr key={agreement.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(agreement.id)}
                          onChange={() => toggleAgreement(agreement.id)}
                          aria-label={`Select agreement for ${agreement.clientName || "unnamed client"}`}
                          className="theme-checkbox h-4 w-4 rounded border-slate-300 focus:ring-slate-400"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">Client agreement</p>
                        <p className="mt-1 font-mono text-xs text-slate-400">{agreement.id}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{agreement.clientName || "Unnamed client"}</p>
                        {contact ? <p className="mt-1 text-xs text-slate-500">{contact}</p> : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatDate(agreement.agreementSentAt ?? agreement.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatDate(agreement.signedAt)}
                        {agreement.signerName ? <p className="mt-1 text-xs text-slate-500">{agreement.signerName}</p> : null}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{paymentStatus(agreement.onboardingFeeStatus)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {offer ? (
                            <Link
                              href={`/offers/${offer.id}`}
                              aria-label="View offer"
                              title="View offer"
                              className="ui-action-ghost inline-flex h-9 w-9 items-center justify-center rounded-full transition"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          ) : null}
                          {agreement.agreementManagerStatus === "ACTIVE" ? (
                            <>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => { if (agreement.signedAt) setCancellationReason(""); setConfirmation({ ids: [agreement.id], action: agreement.signedAt ? "requestCancellation" : "void", label: agreement.signedAt ? "request cancellation" : "void" }); }}
                                aria-label={agreement.signedAt ? "Request agreement cancellation" : "Void agreement"}
                                title={agreement.signedAt ? "Request agreement cancellation" : "Void agreement"}
                                className="ui-action-ghost inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:text-red-700 disabled:opacity-50"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => setConfirmation({ ids: [agreement.id], action: "archive", label: "archive" })}
                                aria-label="Archive agreement"
                                title="Archive agreement"
                                className="ui-action-ghost inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:text-slate-900 disabled:opacity-50"
                              >
                                <Archive className="h-4 w-4" />
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => setConfirmation({ ids: [agreement.id], action: "delete", label: "delete" })}
                            aria-label="Delete agreement"
                            title="Delete agreement"
                            className="ui-action-ghost inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:text-red-700 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {confirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="agreement-action-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="agreement-action-title" className="text-lg font-semibold text-slate-900">
              {confirmation.label[0].toUpperCase() + confirmation.label.slice(1)} {confirmation.ids.length > 1 ? `${confirmation.ids.length} agreements` : "agreement"}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Are you sure you want to {confirmation.label} {confirmation.ids.length > 1 ? "these agreements" : "this agreement"}?{" "}
              {confirmation.action === "delete"
                ? "This permanently deletes the selected agreement records and cannot be undone."
                : `The ${confirmation.ids.length > 1 ? "selected agreement records" : "agreement record"} will be updated in the manager.`}
            </p>
            {confirmation.action === "requestCancellation" ? (
              <div className="mt-4">
                <label htmlFor="agreement-cancellation-reason" className="text-sm font-semibold text-slate-700">
                  Reason <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="agreement-cancellation-reason"
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                  rows={3}
                  placeholder="Why is cancellation being requested?"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/20"
                />
              </div>
            ) : null}
            {actionError ? <p className="mt-3 text-sm text-red-700">{actionError}</p> : null}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmation(null)} disabled={isPending} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmAction} disabled={isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {isPending ? "Working…" : confirmation.label[0].toUpperCase() + confirmation.label.slice(1)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
