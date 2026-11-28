"use client";

import { useState, useTransition } from "react";
import {
  CASH_EXCLUSIONS, CHECKLISTS, CHECK_ITEMS, PRIVATE_SALE_NOTE, SECTIONS, STATUSES, TAX_RATE, candidateName,
  cashNeeded, costTotals, formatMoney, sectionFor, sortedCandidates,
  type Change, type SectionKey, type VanItem, type VanPlan,
} from "@/lib/van/plan";
import { changeVanAction, startVanAction } from "./actions";

const button = "ui-action-secondary ui-focus-ring min-h-11 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50";
const primary = "ui-action-primary ui-focus-ring min-h-11 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50";
const input = "ui-focus-ring min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900";
const card = "min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
type Controls = { pending: boolean; run: (change: Change, after?: () => void) => void };

/** Works on plain-HTTP local previews too, where randomUUID is unavailable. */
function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function VanClient({ plan }: { plan: VanPlan | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  function submit(action: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else { setSaved(true); after?.(); }
      } catch { setError("That did not save. Check your connection and try again."); }
    });
  }
  const controls: Controls = { pending, run: (change, after) => submit(() => changeVanAction(change), after) };

  return (
    <div className="mx-auto max-w-6xl p-4 text-base text-slate-900 sm:p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Van</h1>
        <p className="mt-2 text-slate-600">A home and a place to work. Cash budget $30–50K.</p>
        <p role="status" aria-live="polite" className="mt-1 min-h-6 text-sm text-slate-500">{pending ? "Saving…" : saved ? "Saved" : "Your van hunt, all in one place."}</p>
      </header>

      {!plan ? (
        <section className={`${card} mt-6`} aria-label="Start a van hunt">
          <h2 className="text-xl font-semibold">Start the hunt</h2>
          <p className="mt-2 text-slate-600">Donna found three picks and two backups. Prices and details are a 2026-11-28 snapshot; check availability with the seller.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button className={primary} disabled={pending} onClick={() => submit(() => startVanAction("shortlist"))}>Start from Donna&apos;s 2026-11-28 shortlist</button>
            <button className={button} disabled={pending} onClick={() => submit(() => startVanAction("empty"))}>Start with my own vans</button>
          </div>
        </section>
      ) : (
        <>
          <nav aria-label="Van sections" className="mt-4 flex flex-wrap gap-2">
            {SECTIONS.map((section) => <a key={section.key} href={`#${section.key}`} className={button}>{section.title}</a>)}
          </nav>
          <SimpleList section="needs" items={plan.sections.needs} controls={controls} />
          <Candidates items={plan.sections.candidates} controls={controls} />
          <SimpleList section="costs" items={plan.sections.costs} controls={controls} />
        </>
      )}
      {error ? <div role="alert" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 shadow-lg"><p className="flex-1">{error}</p><button className={button} onClick={() => setError(null)}>Dismiss</button></div> : null}
    </div>
  );
}

function SimpleList({ section, items, controls }: { section: "needs" | "costs"; items: VanItem[]; controls: Controls }) {
  const [editing, setEditing] = useState<VanItem | null>(null);
  const definition = sectionFor(section);
  const totals = costTotals(items);
  return (
    <section id={section} aria-labelledby={`${section}-heading`} className="mt-8 scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${section}-heading`} className="text-2xl font-semibold">{definition.title}</h2>
        <button className={button} disabled={controls.pending} onClick={() => setEditing({ id: newId() })}>Add {definition.itemLabel}</button>
      </div>
      {section === "costs" ? <p className="mt-2 text-slate-600">Quoted total <strong className="text-slate-900">{formatMoney(totals.total)}</strong> · {totals.unquoted} unquoted. Use the same period for amounts you total.</p> : null}
      {editing ? <ItemEditor key={editing.id} section={section} item={editing} controls={controls} onClose={() => setEditing(null)} /> : null}
      <ul className={`${card} mt-3 divide-y divide-slate-100`}>
        {items.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1 basis-40 break-words">
            <p className="font-medium">{String(item.name)}{section === "costs" ? <span className="ml-2">{typeof item.amount === "number" ? formatMoney(item.amount) : "Not quoted"}</span> : null}</p>
            {item.notes ? <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{String(item.notes)}</p> : null}
          </div>
          <button className={button} disabled={controls.pending} aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}>Edit</button>
          <RemoveButton section={section} item={item} controls={controls} />
        </li>)}
        {!items.length ? <li className="text-slate-500">No {section === "needs" ? "must-haves" : "costs"} yet.</li> : null}
      </ul>
    </section>
  );
}

function Candidates({ items, controls }: { items: VanItem[]; controls: Controls }) {
  const [editing, setEditing] = useState<VanItem | null>(null);
  return (
    <section id="candidates" aria-labelledby="candidates-heading" className="mt-8 scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="candidates-heading" className="text-2xl font-semibold">Candidates <span className="text-slate-400">{items.length}</span></h2>
        <button className={primary} disabled={controls.pending} onClick={() => setEditing({ id: newId(), status: "Watching" })}>Add candidate</button>
      </div>
      <p className="mt-2 text-sm text-slate-600">Sorted by status, then price. Listing facts from Donna&apos;s 2026-11-28 shortlist may have changed.</p>
      <p className="mt-2 text-sm text-slate-600">{PRIVATE_SALE_NOTE}</p>
      {editing ? <ItemEditor key={editing.id} section="candidates" item={editing} controls={controls} onClose={() => setEditing(null)} /> : null}
      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {sortedCandidates(items).map((item) => <CandidateCard key={item.id} item={item} controls={controls} onEdit={() => setEditing(item)} />)}
      </div>
      {!items.length ? <p className={`${card} mt-4 text-slate-500`}>No vans yet. Add one to compare it and keep its inspection checklist.</p> : null}
    </section>
  );
}

function CandidateCard({ item, controls, onEdit }: { item: VanItem; controls: Controls; onEdit: () => void }) {
  const name = candidateName(item);
  const cash = cashNeeded(typeof item.price === "number" ? item.price : null);
  const specs = sectionFor("candidates").fields.filter((field) => !["year", "make", "model", "price", "miles", "city", "status", "link", "notes"].includes(field.key));
  return (
    <article className={`${card} break-words`} aria-label={name}>
      <h3 className="text-xl font-semibold leading-snug">{name}</h3>
      <p className="mt-2 text-slate-600">{typeof item.miles === "number" ? `${item.miles.toLocaleString("en-US")} mi` : "Miles not listed"} · {item.city || "City not listed"}</p>
      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="text-sm text-slate-500">Asking price</p>
        <p className="text-2xl font-semibold">{typeof item.price === "number" ? formatMoney(item.price) : "Not listed"}</p>
        <p className="mt-3 font-semibold">Cash needed: {cash ? formatMoney(cash.total) : "Add a price"}</p>
        <p className="mt-1 text-sm text-slate-600">{CASH_EXCLUSIONS}</p>
        {cash ? <p className="mt-2 text-sm text-slate-600">{formatMoney(cash.price)} price + {formatMoney(cash.tax)} Texas tax ({TAX_RATE * 100}%) + {formatMoney(cash.title)} title</p> : null}
      </div>
      <label className="mt-4 flex flex-col gap-1 text-sm font-medium">Status
        <select className={input} aria-label={`Status for ${name}`} value={String(item.status)} disabled={controls.pending} onChange={(event) => controls.run({ kind: "status", id: item.id, status: event.target.value as typeof STATUSES[number] })}>
          {STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
      </label>
      {item.notes ? <p className="mt-4 whitespace-pre-line text-slate-700">{String(item.notes)}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.link ? <a href={String(item.link)} target="_blank" rel="noreferrer" className={`${button} inline-flex items-center`}>Open listing ↗</a> : null}
        <button className={button} disabled={controls.pending} onClick={onEdit}>Edit van</button>
        <RemoveButton section="candidates" item={item} controls={controls} />
      </div>
      <details className="mt-4 border-t border-slate-200 pt-2">
        <summary className="ui-focus-ring flex min-h-11 cursor-pointer items-center justify-between gap-2 font-semibold">Seller &amp; van details <span aria-hidden="true">⌄</span></summary>
        <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {specs.map((field) => <div key={field.key} className={field.type === "long" ? "sm:col-span-2" : ""}>
            <dt className="text-sm text-slate-500">{field.label}</dt>
            <dd className="whitespace-pre-line">{shownValue(item[field.key])}</dd>
          </div>)}
        </dl>
      </details>
      <details className="mt-2 border-t border-slate-200 pt-2">
        <summary className="ui-focus-ring flex min-h-11 cursor-pointer items-center justify-between gap-2 font-semibold"><span>Inspection &amp; test drive · {CHECK_ITEMS.filter((check) => item[check.key] === true).length} / {CHECK_ITEMS.length}</span><span aria-hidden="true">⌄</span></summary>
        <div className="mt-2 space-y-5">
          {CHECKLISTS.map((list) => <fieldset key={list.title} disabled={controls.pending}>
            <legend className="mb-1 font-semibold">{list.title}</legend>
            {list.items.map((check) => <label key={check.key} className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
              <input className="ui-focus-ring h-5 w-5 shrink-0" type="checkbox" checked={item[check.key] === true} onChange={(event) => controls.run({ kind: "check", id: item.id, key: check.key, done: event.target.checked })} />
              {check.label}
            </label>)}
          </fieldset>)}
        </div>
      </details>
    </article>
  );
}

function shownValue(value: VanItem[string] | undefined) {
  if (value === null || value === undefined || value === "") return "Not listed";
  return typeof value === "number" ? value.toLocaleString("en-US") : String(value);
}

function ItemEditor({ section, item, controls, onClose }: { section: SectionKey; item: VanItem; controls: Controls; onClose: () => void }) {
  const definition = sectionFor(section);
  return (
    <form className={`${card} mt-4`} aria-label={`Edit ${definition.itemLabel}`} onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const next: VanItem = { id: item.id };
      for (const field of definition.fields) {
        const raw = String(data.get(field.key) ?? "").trim();
        next[field.key] = field.type === "money" || field.type === "number" ? (raw === "" ? null : Number(raw)) : raw;
      }
      controls.run({ kind: "save", section, item: next }, onClose);
    }}>
      <fieldset disabled={controls.pending} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold">Edit {definition.itemLabel}</legend>
        {definition.fields.map((field) => <label key={field.key} className={`flex min-w-0 flex-col gap-1 text-sm font-medium ${field.type === "long" ? "sm:col-span-2" : ""}`}>
          {field.label}
          {field.type === "long" ? <textarea name={field.key} rows={3} maxLength={5000} defaultValue={String(item[field.key] ?? "")} className={input} />
            : field.type === "status" ? <select name={field.key} defaultValue={String(item.status ?? "Watching")} className={input}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
              : <input className={input} name={field.key} required={field.required} maxLength={field.type === "url" ? 2000 : 200} defaultValue={String(item[field.key] ?? "")}
                type={field.type === "money" || field.type === "number" ? "number" : field.type === "url" ? "url" : "text"}
                inputMode={field.type === "money" || field.type === "number" ? field.integer ? "numeric" : "decimal" : undefined}
                min={field.min ?? 0} max={field.max ?? 9_999_999} step={field.integer ? 1 : 0.01} />}
        </label>)}
        <div className="flex gap-2 sm:col-span-2"><button type="submit" className={primary}>Save</button><button type="button" className={button} onClick={onClose}>Cancel</button></div>
      </fieldset>
    </form>
  );
}

function RemoveButton({ section, item, controls }: { section: SectionKey; item: VanItem; controls: Controls }) {
  const [confirming, setConfirming] = useState(false);
  const name = section === "candidates" ? candidateName(item) : String(item.name);
  return confirming ? <span className="flex flex-wrap gap-2"><button className={button} disabled={controls.pending} onClick={() => controls.run({ kind: "remove", section, id: item.id }, () => setConfirming(false))}>Confirm remove</button><button className={button} disabled={controls.pending} onClick={() => setConfirming(false)}>Keep</button></span>
    : <button className={button} disabled={controls.pending} aria-label={`Remove ${name}`} onClick={() => setConfirming(true)}>Remove</button>;
}
