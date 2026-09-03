"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { createOfferAudienceContactAction } from "./who/actions";
import { reassignQuoteContactAction } from "./actions";

const NEW_CONTACT_VALUE = "__new_contact__";

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

export function OfferContactCell({
  offerId,
  currentContact,
  contacts,
}: {
  offerId: string;
  currentContact: CurrentContact;
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showContactOptions, setShowContactOptions] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const options = useMemo(() => {
    if (!currentContact.contactId) return contacts;
    const seen = new Set(contacts.map((contact) => contact.id));
    if (seen.has(currentContact.contactId)) return contacts;
    return [
      {
        id: currentContact.contactId,
        name: currentContact.name,
        company: currentContact.company,
        email: currentContact.email,
      },
      ...contacts,
    ];
  }, [contacts, currentContact]);

  const filteredOptions = useMemo(() => {
    const query = contactQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter((contact) =>
      [contact.name, contact.company, contact.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [contactQuery, options]);

  function toggleContactOptions() {
    setShowContactOptions((shown) => !shown);
    setContactQuery("");
  }

  function saveContact(contactId: string) {
    if (!contactId || contactId === currentContact.contactId) return;
    const data = new FormData();
    data.set("id", offerId);
    data.set("contactId", contactId);
    startTransition(async () => {
      try {
        setError(null);
        await reassignQuoteContactAction(data);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not change the contact.");
      }
    });
  }

  function selectContact(contactId: string) {
    if (contactId === currentContact.contactId) {
      setShowContactOptions(false);
      return;
    }

    if (contactId === NEW_CONTACT_VALUE) {
      if (currentContact.contactId && !window.confirm("Are you sure you want to select a new contact?")) {
        return;
      }
      setShowContactOptions(false);
      setContactQuery("");
      setShowNewContact(true);
      setError(null);
      return;
    }

    setShowContactOptions(false);
    setContactQuery("");
    saveContact(contactId);
  }

  function cancelNewContact() {
    setShowNewContact(false);
    setError(null);
  }

  function createNewContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      try {
        setError(null);
        const contact = await createOfferAudienceContactAction(data);
        setShowNewContact(false);
        saveContact(contact.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add contact.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={showContactOptions}
          aria-haspopup="listbox"
          disabled={pending}
          onClick={toggleContactOptions}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
        >
          {currentContact.contactId ? currentContact.company || currentContact.name : "Select contact"}
        </button>
        {pending ? <span className="text-xs text-slate-500">Saving...</span> : null}
      </div>

      {showContactOptions && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
              role="presentation"
              onClick={() => setShowContactOptions(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={`offer-contact-dialog-${offerId}`}
                className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 id={`offer-contact-dialog-${offerId}`} className="text-lg font-semibold text-slate-900">
                    Select contact
                  </h2>
                  <button
                    type="button"
                    aria-label="Close contact selector"
                    title="Close contact selector"
                    onClick={() => setShowContactOptions(false)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={18} />
                  </button>
                </div>
                <label className="relative mt-4 block">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={contactQuery}
                    onChange={(event) => setContactQuery(event.target.value)}
                    placeholder="Search name, business, or email"
                    aria-label="Search contacts"
                    autoFocus
                    className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                  />
                </label>
                <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-slate-200 p-1" role="listbox" aria-label="Select offer contact">
                  <button
                    type="button"
                    onClick={() => selectContact(NEW_CONTACT_VALUE)}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    New contact...
                  </button>
                  {filteredOptions.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      role="option"
                      aria-selected={contact.id === currentContact.contactId}
                      onClick={() => selectContact(contact.id)}
                      className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="block text-sm font-medium text-slate-800">
                        {contact.name}
                        {contact.company ? ` - ${contact.company}` : ""}
                      </span>
                      <span className="block text-xs text-slate-500">{contact.email || "No email on file"}</span>
                    </button>
                  ))}
                  {filteredOptions.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-slate-400">No matching contacts.</p>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showNewContact ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New contact</p>
          <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={createNewContact}>
            <input name="firstName" required placeholder="First name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="lastName" required placeholder="Last name" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="email" type="email" placeholder="Email" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="phone" type="tel" placeholder="Phone" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="company" placeholder="Company" className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={pending} className="ui-action-primary rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                {pending ? "Saving..." : "Add contact"}
              </button>
              <button type="button" disabled={pending} onClick={cancelNewContact} className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
