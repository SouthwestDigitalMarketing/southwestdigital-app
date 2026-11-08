"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { archiveLeadAction, restoreLeadAction, updateLeadAction } from "./actions";

type Lead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  expectedServices: string | null;
  notes: string | null;
  nextAction: string | null;
  nextDue: string | null;
  amount: number | null;
  amountKind: string | null;
  pipeId: string | null;
  isActive: boolean;
};

const button = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold";
const input = "ui-focus-ring min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900";
const label = "grid gap-1.5 text-sm font-medium text-slate-700";

export function LeadManagement({ lead }: { lead: Lead }) {
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (!lead.isActive) {
    return (
      <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">This lead is archived. It is hidden from active dashboard and pipeline views.</p>
        <form action={restoreLeadAction}>
          <input type="hidden" name="leadId" value={lead.id} />
          <button type="submit" className={`${button} ui-action-primary w-full sm:w-auto`}>
            <ArchiveRestore size={18} aria-hidden="true" /> Restore lead
          </button>
        </form>
      </section>
    );
  }

  return (
    <>
      {lead.pipeId ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
          Synced from Sales as deal {lead.pipeId}. Name, contact, estimate, and follow-up fields are managed in Sales and may be overwritten by sync. Notes and expected services can be edited here.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setEditing((value) => !value)} className={`${button} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`}>
          {editing ? <X size={18} aria-hidden="true" /> : <Pencil size={18} aria-hidden="true" />}
          {editing ? "Cancel edit" : "Edit details"}
        </button>
        <button type="button" onClick={() => setConfirmArchive(true)} className={`${button} border border-rose-300 bg-white text-rose-800 hover:bg-rose-50`}>
          <Archive size={18} aria-hidden="true" /> Archive lead
        </button>
      </div>

      {editing ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">Edit lead details</h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {lead.pipeId
              ? "Only local notes and expected services can be changed here. Edit synced fields in Sales."
              : "Update this lead’s details. Pipeline stage changes stay on the pipeline board."}
          </p>
          <form action={updateLeadAction} className="mt-4 grid gap-4">
            <input type="hidden" name="leadId" value={lead.id} />
            {!lead.pipeId ? (
              <>
                <label className={label}>Name<input required name="name" defaultValue={lead.name} className={input} /></label>
                <label className={label}>Company<input name="company" defaultValue={lead.company ?? ""} className={input} /></label>
                <label className={label}>Email<input name="email" type="email" inputMode="email" defaultValue={lead.email ?? ""} className={input} /></label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={label}>Estimated amount<input name="amount" type="number" min="0" step="0.01" defaultValue={lead.amount ?? ""} className={input} /></label>
                  <label className={label}>Amount type<input name="amountKind" defaultValue={lead.amountKind ?? ""} placeholder="One-time, monthly…" className={input} /></label>
                </div>
                <label className={label}>Next action<input name="nextAction" defaultValue={lead.nextAction ?? ""} className={input} /></label>
                <label className={label}>Next due<input name="nextDue" type="date" defaultValue={lead.nextDue ?? ""} className={input} /></label>
              </>
            ) : (
              <>
                <input type="hidden" name="name" value={lead.name} />
                <input type="hidden" name="company" value={lead.company ?? ""} />
                <input type="hidden" name="email" value={lead.email ?? ""} />
                <input type="hidden" name="amount" value={lead.amount ?? ""} />
                <input type="hidden" name="amountKind" value={lead.amountKind ?? ""} />
                <input type="hidden" name="nextAction" value={lead.nextAction ?? ""} />
                <input type="hidden" name="nextDue" value={lead.nextDue ?? ""} />
              </>
            )}
            <label className={label}>Expected services<textarea name="expectedServices" rows={3} defaultValue={lead.expectedServices ?? ""} className={`${input} min-h-24`} /></label>
            <label className={label}>Notes<textarea name="notes" rows={4} defaultValue={lead.notes ?? ""} className={`${input} min-h-28`} /></label>
            <button type="submit" className={`${button} ui-action-primary w-full sm:w-auto`}>Save changes</button>
          </form>
        </section>
      ) : null}

      {confirmArchive ? (
        <Modal onClose={() => setConfirmArchive(false)} labelledBy="archive-lead-title" className="max-w-md">
          <div className="rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="archive-lead-title" className="text-lg font-semibold text-slate-900">Archive {lead.name}?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">This hides the lead from active SWapp dashboard and pipeline views. It keeps the record so you can restore it later.</p>
                {lead.pipeId ? <p className="mt-2 text-sm leading-6 text-amber-800">The Sales source record stays unchanged. SWapp will keep this copy archived when that deal syncs again.</p> : null}
              </div>
              <button type="button" onClick={() => setConfirmArchive(false)} aria-label="Close archive confirmation" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <form action={archiveLeadAction} className="mt-5 grid grid-cols-2 gap-3">
              <input type="hidden" name="leadId" value={lead.id} />
              <button type="button" onClick={() => setConfirmArchive(false)} className={`${button} border border-slate-300 bg-white text-slate-800`}>Cancel</button>
              <button type="submit" className={`${button} bg-rose-700 text-white hover:bg-rose-800`}>Archive lead</button>
            </form>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
