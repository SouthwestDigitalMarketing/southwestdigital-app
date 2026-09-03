"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [selectedContactId, setSelectedContactId] = useState(currentContact.contactId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [showNewContact, setShowNewContact] = useState(false);
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
        setSelectedContactId(currentContact.contactId ?? "");
        setError(err instanceof Error ? err.message : "Could not change the contact.");
      }
    });
  }

  function selectContact(contactId: string) {
    if (contactId === currentContact.contactId) return;

    if (contactId === NEW_CONTACT_VALUE) {
      if (currentContact.contactId && !window.confirm("Are you sure you want to select a new contact?")) {
        setSelectedContactId(currentContact.contactId);
        return;
      }
      setSelectedContactId(NEW_CONTACT_VALUE);
      setShowNewContact(true);
      setError(null);
      return;
    }

    const nextContact = options.find((contact) => contact.id === contactId);
    const label = nextContact?.name ?? "this contact";
    if (!window.confirm(`Are you sure you want to assign this offer to ${label}?`)) {
      setSelectedContactId(currentContact.contactId ?? "");
      return;
    }

    setSelectedContactId(contactId);
    saveContact(contactId);
  }

  function cancelNewContact() {
    setShowNewContact(false);
    setSelectedContactId(currentContact.contactId ?? "");
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
        setSelectedContactId(contact.id);
        saveContact(contact.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add contact.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`offer-contact-${offerId}`}>
          Select offer contact
        </label>
        <select
          id={`offer-contact-${offerId}`}
          value={selectedContactId}
          onChange={(event) => selectContact(event.target.value)}
          disabled={pending}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
        >
          {!currentContact.contactId ? <option value="">Select contact</option> : null}
          <option value={NEW_CONTACT_VALUE}>New contact...</option>
          {options.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}
              {contact.company ? ` - ${contact.company}` : ""}
              {contact.email ? ` - ${contact.email}` : ""}
            </option>
          ))}
        </select>
        {pending ? <span className="text-xs text-slate-500">Saving...</span> : null}
      </div>

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
