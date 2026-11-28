"use client";

import { useState } from "react";
import {
  ACCOUNT_KINDS,
  ACCOUNT_KIND_LABELS,
  resolveTransactionBand,
  summarizeAccountInventory,
  validateBandOverride,
  type AccountEntry,
  type BandOverride,
} from "@/lib/quotes/accountInventory";

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
const bands = ["0-99", "100-499", "500-999", "1000+", "unknown"] as const;

/** Fresh draft values for the override form: the saved override, or blank defaults. */
export function initialOverrideDraft(override: BandOverride | null): { band: BandOverride["band"]; reason: string } {
  return { band: override?.band ?? "100-499", reason: override?.reason ?? "" };
}

/** Remount key so a newly loaded override always replaces a stale draft. */
export function overrideDraftKey(override: BandOverride | null): string {
  return override ? `${override.band}::${override.reason}` : "none";
}

export function AccountInventoryOverrideForm({ initial, onApply, onCancel }: {
  initial: { band: BandOverride["band"]; reason: string };
  onApply: (override: BandOverride) => void;
  onCancel: () => void;
}) {
  const [draftBand, setDraftBand] = useState<BandOverride["band"]>(initial.band);
  const [reason, setReason] = useState(initial.reason);
  const [error, setError] = useState("");
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-[9rem_1fr_auto]">
      <label className="text-xs font-medium">Band<select className={inputClass} value={draftBand} onChange={(event) => setDraftBand(event.target.value as BandOverride["band"])}>{bands.map((band) => <option key={band} value={band}>{band}</option>)}</select></label>
      <label className="text-xs font-medium">One-line reason<input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <div className="flex items-end gap-2">
        <button type="button" className="self-end rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={() => { const override = { band: draftBand, reason: reason.trim() }; const result = validateBandOverride(override); if (!result.ok) { setError(result.error); return; } setError(""); onApply(override); }}>Apply override</button>
        <button type="button" className="self-end rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600" onClick={onCancel}>Cancel</button>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-red-700 sm:col-span-3">{error}</p> : null}
    </div>
  );
}

export default function AccountInventoryEditor({ accounts, bandOverride, onAccountsChange, onOverrideChange }: {
  accounts: AccountEntry[];
  bandOverride: BandOverride | null;
  onAccountsChange: (accounts: AccountEntry[]) => void;
  onOverrideChange: (override: BandOverride | null) => void;
}) {
  const summary = summarizeAccountInventory(accounts);
  const resolved = resolveTransactionBand({ accounts, bandOverride });
  // The form mounts only while the editor is open (keyed by the saved
  // override), so opening it always starts from the loaded values and
  // Cancel restores them by discarding the draft unmount.
  const [editorOpen, setEditorOpen] = useState(false);
  function update(id: string, patch: Partial<AccountEntry>) {
    onAccountsChange(accounts.map((account) => account.id === id ? { ...account, ...patch } : account));
  }
  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Account inventory</h3>
        <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => onAccountsChange([...accounts, { id: crypto.randomUUID(), kind: "checking", label: "", status: "open", monthlyTransactions: 0, basis: "estimated" }])}>Add account</button>
      </div>
      {accounts.map((account, index) => (
        <fieldset key={account.id} className={`rounded-xl border border-slate-200 p-3 ${account.status === "closed" ? "bg-slate-100 text-slate-500" : "bg-slate-50 text-slate-700"}`}>
          <legend className="px-1 text-sm font-semibold">Account {index + 1}{account.status === "closed" ? " · Closed — excluded" : ""}</legend>
          <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${account.status === "closed" ? "opacity-60" : ""}`}>
            <label className="text-xs font-medium">Kind<select className={inputClass} value={account.kind} onChange={(event) => update(account.id, { kind: event.target.value as AccountEntry["kind"] })}>{ACCOUNT_KINDS.map((kind) => <option key={kind} value={kind}>{ACCOUNT_KIND_LABELS[kind]}</option>)}</select></label>
            <label className="text-xs font-medium">Label<input className={inputClass} value={account.label} placeholder="Chase checking" onChange={(event) => update(account.id, { label: event.target.value })} /></label>
            <label className="text-xs font-medium">Last 4 digits<input className={inputClass} value={account.last4 ?? ""} maxLength={4} inputMode="numeric" pattern="[0-9]{0,4}" autoComplete="off" onChange={(event) => update(account.id, { last4: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
            <label className="text-xs font-medium">Status<select className={inputClass} value={account.status} onChange={(event) => update(account.id, { status: event.target.value as AccountEntry["status"] })}><option value="open">Open</option><option value="closed">Closed</option></select></label>
            <label className="text-xs font-medium">Monthly transactions<input className={inputClass} type="number" min={0} step={1} inputMode="numeric" value={account.monthlyTransactions} onChange={(event) => { const count = Number(event.target.value); update(account.id, { monthlyTransactions: Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0 }); }} /></label>
            <label className="text-xs font-medium">Basis<select className={inputClass} value={account.basis} onChange={(event) => update(account.id, { basis: event.target.value as AccountEntry["basis"] })}><option value="measured">Measured</option><option value="estimated">Estimated</option></select></label>
            <label className="text-xs font-medium sm:col-span-2">Source note<input className={inputClass} value={account.source ?? ""} maxLength={120} placeholder="QBO feed Jun–Aug 2026, or client said" onChange={(event) => update(account.id, { source: event.target.value })} /></label>
          </div>
          <button type="button" aria-label={`Remove account ${index + 1}`} className="mt-2 text-sm font-medium text-slate-600 underline" onClick={() => onAccountsChange(accounts.filter((row) => row.id !== account.id))}>Remove</button>
        </fieldset>
      ))}
      <p className="text-sm font-semibold text-slate-700">Open accounts: {summary.openMonthlyTotal.toLocaleString("en-US")} transactions per month</p>
      {summary.hasInventory ? <p className="text-xs text-slate-500">Open accounts also set the bank, credit card, loan, line of credit, and vehicle note counts.</p> : null}
      {summary.warnings.map((warning) => <p key={warning} role="status" className="text-sm text-amber-800">{warning}</p>)}
      {summary.hasInventory ? (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-800">Band: {resolved.band} ({resolved.source === "override" ? `manual override; accounts say ${summary.derivedBand ?? ""}` : "from accounts"})</p>
          {bandOverride ? <p className="text-sm text-slate-600">Override reason: {bandOverride.reason}</p> : null}
          <details open={editorOpen} onToggle={(event) => setEditorOpen(event.currentTarget.open)}>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">Override band</summary>
            {editorOpen ? (
              <AccountInventoryOverrideForm
                key={overrideDraftKey(bandOverride)}
                initial={initialOverrideDraft(bandOverride)}
                onApply={(override) => { onOverrideChange(override); setEditorOpen(false); }}
                onCancel={() => setEditorOpen(false)}
              />
            ) : null}
          </details>
          {bandOverride ? <button type="button" className="text-sm text-slate-600 underline" onClick={() => onOverrideChange(null)}>Use band from accounts</button> : null}
        </div>
      ) : null}
    </div>
  );
}
