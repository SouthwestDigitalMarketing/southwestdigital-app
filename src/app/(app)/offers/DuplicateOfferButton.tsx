"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Copy, Search, X } from "lucide-react";
import { duplicateQuoteAction } from "./actions";

type ContactOption = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
};

type CurrentContact = {
  contactId: string | null;
  name: string;
  company: string | null;
  email: string | null;
};

export function DuplicateOfferButton({
  offerId,
  currentContact,
  contacts,
  archived,
}: {
  offerId: string;
  currentContact: CurrentContact;
  contacts: ContactOption[];
  archived: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.company, c.email].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [contacts, query]);

  function submit(contactId: string | null) {
    const data = new FormData();
    data.set("id", offerId);
    if (contactId) data.set("contactId", contactId);
    if (archived) data.set("archived", "1");
    startTransition(async () => {
      try {
        setError(null);
        await duplicateQuoteAction(data);
      } catch (err) {
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        setError(err instanceof Error ? err.message : "Could not duplicate offer.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Duplicate offer"
        title="Duplicate offer"
        disabled={pending}
        onClick={() => {
          setOpen(true);
          setQuery("");
          setError(null);
        }}
        className="ui-action-ghost inline-flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-40"
      >
        <Copy className="h-4 w-4" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
              role="presentation"
              onClick={() => !pending && setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={`duplicate-offer-dialog-${offerId}`}
                className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 id={`duplicate-offer-dialog-${offerId}`} className="text-lg font-semibold text-slate-900">
                    Duplicate offer for…
                  </h2>
                  <button
                    type="button"
                    aria-label="Close"
                    disabled={pending}
                    onClick={() => setOpen(false)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                  >
                    <X size={18} />
                  </button>
                </div>

                <p className="mt-2 text-base text-slate-600">
                  Choose the contact this duplicate is for. Their info will pre-populate the contact step.
                </p>

                {currentContact.contactId ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submit(null)}
                    className="mt-4 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 disabled:opacity-40"
                  >
                    <span className="block text-base font-semibold text-slate-800">
                      Keep {currentContact.name}
                      {currentContact.company ? ` — ${currentContact.company}` : ""}
                    </span>
                    <span className="block text-base text-slate-500">
                      Duplicate as-is with the same contact
                    </span>
                  </button>
                ) : null}

                <label className="relative mt-4 block">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name, business, or email"
                    aria-label="Search contacts"
                    autoFocus
                    className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-base text-slate-700 focus:border-slate-400 focus:outline-none"
                  />
                </label>

                <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-slate-200 p-1" role="listbox" aria-label="Select duplicate contact">
                  {filtered.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      disabled={pending}
                      onClick={() => submit(contact.id)}
                      className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-40"
                    >
                      <span className="block text-base font-medium text-slate-800">
                        {contact.name}
                        {contact.company ? ` — ${contact.company}` : ""}
                      </span>
                      <span className="block text-base text-slate-500">{contact.email || "No email on file"}</span>
                    </button>
                  ))}
                  {filtered.length === 0 ? (
                    <p className="px-3 py-3 text-base text-slate-400">No matching contacts.</p>
                  ) : null}
                </div>

                {pending ? <p className="mt-3 text-base text-slate-500">Duplicating…</p> : null}
                {error ? <p className="mt-3 text-base text-rose-600">{error}</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
