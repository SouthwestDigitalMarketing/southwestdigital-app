"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import {
  createOfferAudienceContactAction,
  searchOfferContactsAction,
  startOfferDraftAction,
  type OfferAudienceContact,
} from "./actions";
import { builderHref, type OfferKindKey } from "@/lib/quotes/kinds";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function OfferAudiencePicker({
  kind,
  kindLabel,
  initialContacts,
  initialSelected,
  tags,
}: {
  kind: OfferKindKey;
  kindLabel: string;
  initialContacts: OfferAudienceContact[];
  initialSelected: OfferAudienceContact[];
  tags: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [results, setResults] = useState(initialContacts);
  const [selected, setSelected] = useState<OfferAudienceContact[]>(initialSelected);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.id)), [selected]);
  const selectedTagIds = useMemo(() => new Set(tagIds), [tagIds]);

  function toggle(contact: OfferAudienceContact) {
    setSelected((current) =>
      current.some((item) => item.id === contact.id)
        ? current.filter((item) => item.id !== contact.id)
        : [...current, contact],
    );
  }

  function runSearch(nextQuery: string, nextTagIds: string[], delay = 0) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const go = () => {
      startTransition(async () => {
        try {
          setResults(await searchOfferContactsAction(nextQuery, nextTagIds));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not search contacts");
        }
      });
    };
    if (delay) searchTimer.current = setTimeout(go, delay);
    else go();
  }

  function search(value: string) {
    setQuery(value);
    runSearch(value, tagIds, 200);
  }

  function toggleTag(tagId: string) {
    const next = tagIds.includes(tagId) ? tagIds.filter((id) => id !== tagId) : [...tagIds, tagId];
    setTagIds(next);
    runSearch(query, next);
  }

  function continueToOffer() {
    if (selected.length === 0) {
      setError("Select at least one contact.");
      return;
    }
    setError(null);
    const contactIds = selected.map((item) => item.id);
    startTransition(async () => {
      try {
        const { offerId } = await startOfferDraftAction(kind, contactIds);
        router.push(builderHref(kind, contactIds, offerId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start offer");
      }
    });
  }

  return (
    <div className="mt-6 max-w-6xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-800">Who are we building this offer for?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Search the contacts database. You can attach more than one person — owners, partners, or
          a bookkeeper — and details you fill in on the {kindLabel} offer can write back to those
          records.
        </p>

        {selected.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {selected.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => toggle(contact)}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
              >
                {contact.name}
                <X size={12} />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No one selected yet.</p>
        )}

        <label className="relative mt-4 block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => search(event.target.value)}
            placeholder="Search name, email, company…"
            className={`${inputClass} pl-9`}
          />
        </label>

        {tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => {
              const on = selectedTagIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    on
                      ? "bg-slate-900 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[1.5rem_minmax(9rem,1.2fr)_minmax(7rem,0.8fr)_minmax(7rem,0.9fr)_minmax(10rem,1.2fr)] items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span />
            <span>Name</span>
            <span>Role</span>
            <span>Company</span>
            <span>Email</span>
          </div>
          <ul className="max-h-[28rem] overflow-y-auto">
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-slate-400">No matching contacts.</li>
            ) : (
              results.map((contact) => {
                const on = selectedIds.has(contact.id);
                return (
                  <li key={contact.id} className="border-t border-slate-100 first:border-t-0">
                    <button
                      type="button"
                      onClick={() => toggle(contact)}
                      className={`grid w-full grid-cols-[1.5rem_minmax(9rem,1.2fr)_minmax(7rem,0.8fr)_minmax(7rem,0.9fr)_minmax(10rem,1.2fr)] items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${on ? "bg-slate-50" : ""}`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                          on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
                        }`}
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span className="truncate font-medium text-slate-900">{contact.name}</span>
                      <span className="truncate text-slate-500">{contact.roleTitle || "—"}</span>
                      <span className="truncate text-slate-500">{contact.company || "—"}</span>
                      <span className="truncate text-slate-500">{contact.email || "—"}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Showing {results.length}
          {results.length === 80 ? "+" : ""} match{results.length === 1 ? "" : "es"}. Search or tag
          to narrow a large list.
        </p>

        {showAdd ? (
          <form
            className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              const data = new FormData(event.currentTarget);
              const form = event.currentTarget;
              startTransition(async () => {
                try {
                  const created = await createOfferAudienceContactAction(data);
                  setSelected((current) =>
                    current.some((item) => item.id === created.id) ? current : [...current, created],
                  );
                  form.reset();
                  setShowAdd(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not add contact");
                }
              });
            }}
          >
            <input name="firstName" required placeholder="First name" className={inputClass} />
            <input name="lastName" required placeholder="Last name" className={inputClass} />
            <input name="email" type="email" placeholder="Email" className={inputClass} />
            <input name="company" placeholder="Company" className={inputClass} />
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={pending}
                className="ui-action-primary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition disabled:opacity-50"
              >
                Save to contacts
              </button>
              <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            <Plus size={14} />
            Add a new contact
          </button>
        )}

        {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/offers")}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
          <button
            type="button"
            disabled={pending || selected.length === 0}
            onClick={continueToOffer}
            className="ui-action-primary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
