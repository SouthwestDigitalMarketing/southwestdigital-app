"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import {
  ContactCreateFields,
  type ContactCreationOptions,
} from "@/components/contacts/ContactCreateFields";
import { ContactRelatedCreatePanel } from "@/components/contacts/ContactRelatedCreatePanel";
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

type ContactDialogView = "select" | "create" | "create-client" | "create-tag" | null;

export function OfferContactCell({
  offerId,
  currentContact,
  contacts,
  creationOptions,
}: {
  offerId: string;
  currentContact: CurrentContact;
  contacts: ContactOption[];
  creationOptions: ContactCreationOptions;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [contactDialogView, setContactDialogView] = useState<ContactDialogView>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const capturePortalTarget = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    setPortalTarget((node.closest("[data-theme]") as HTMLElement | null) ?? document.body);
  }, []);
  const [availableCreationOptions, setAvailableCreationOptions] =
    useState<ContactCreationOptions>(creationOptions);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!contactDialogView || pending) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setContactDialogView(null);
      setContactQuery("");
      setError(null);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [contactDialogView, pending]);

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
    setContactDialogView((view) => (view ? null : "select"));
    setContactQuery("");
    setError(null);
  }

  function closeContactDialog() {
    setContactDialogView(null);
    setContactQuery("");
    setError(null);
  }

  function saveContact(contactId: string) {
    startTransition(async () => {
      try {
        setError(null);
        await assignContact(contactId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not change the contact.");
      }
    });
  }

  async function assignContact(contactId: string) {
    if (!contactId || contactId === currentContact.contactId) return;
    const data = new FormData();
    data.set("id", offerId);
    data.set("contactId", contactId);
    await reassignQuoteContactAction(data);
    setContactDialogView(null);
    router.refresh();
  }

  function selectContact(contactId: string) {
    if (contactId === currentContact.contactId) {
      closeContactDialog();
      return;
    }

    if (contactId === NEW_CONTACT_VALUE) {
      if (currentContact.contactId && !window.confirm("Are you sure you want to select a new contact?")) {
        return;
      }
      setContactQuery("");
      setAvailableCreationOptions(creationOptions);
      setSelectedClientIds([]);
      setSelectedTagIds([]);
      setContactDialogView("create");
      setError(null);
      return;
    }

    setContactQuery("");
    saveContact(contactId);
  }

  function cancelNewContact() {
    setContactDialogView("select");
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
        await assignContact(contact.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add contact.");
      }
    });
  }

  return (
    <div ref={capturePortalTarget} className="space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-expanded={contactDialogView !== null}
          aria-haspopup="dialog"
          disabled={pending}
          onClick={toggleContactOptions}
          title={currentContact.contactId ? currentContact.company || currentContact.name : "Select contact"}
          className="min-w-0 max-w-full truncate rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
        >
          {currentContact.contactId ? currentContact.company || currentContact.name : "Select contact"}
        </button>
        {pending ? <span className="text-base text-slate-500">Saving...</span> : null}
      </div>

      {contactDialogView && portalTarget
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
              role="presentation"
              onClick={() => {
                if (!pending) closeContactDialog();
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={`offer-contact-dialog-${offerId}`}
                className="max-h-[90vh] w-full max-w-2xl overflow-x-hidden overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 id={`offer-contact-dialog-${offerId}`} className="text-lg font-semibold text-slate-900">
                    {contactDialogView === "select"
                      ? "Select contact"
                      : contactDialogView === "create-client"
                        ? "Add client"
                        : contactDialogView === "create-tag"
                          ? "Add tag"
                          : "Add a new contact"}
                  </h2>
                  <button
                    type="button"
                    aria-label="Close contact selector"
                    title="Close contact selector"
                    disabled={pending}
                    onClick={closeContactDialog}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    <X size={18} />
                  </button>
                </div>
                {contactDialogView === "select" ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <form
                      className={`${contactDialogView === "create" ? "" : "hidden"} mt-4 grid gap-4 sm:grid-cols-2`}
                      onSubmit={createNewContact}
                    >
                      <p className="text-sm text-slate-500 sm:col-span-2">
                        Add the contact details and relationships you already know. You can edit them later from the contact page.
                      </p>
                      <ContactCreateFields
                        {...availableCreationOptions}
                        autoFocusFirstName
                        defaultSelectedClientIds={selectedClientIds}
                        defaultSelectedTagIds={selectedTagIds}
                        onAddClient={() => setContactDialogView("create-client")}
                        onAddTag={() => setContactDialogView("create-tag")}
                      />
                      <div className="mt-1 flex gap-2 sm:col-span-2">
                        <button type="submit" disabled={pending} className="ui-action-primary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50">
                          {pending ? "Saving..." : "Add contact"}
                        </button>
                        <button type="button" disabled={pending} onClick={cancelNewContact} className="ui-action-secondary rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50">
                          Back
                        </button>
                      </div>
                    </form>

                    {contactDialogView === "create-client" || contactDialogView === "create-tag" ? (
                      <ContactRelatedCreatePanel
                        view={contactDialogView === "create-client" ? "client" : "tag"}
                        onBack={() => setContactDialogView("create")}
                        onClientCreated={(client) => {
                          setAvailableCreationOptions((current) => ({
                            ...current,
                            clients: [client, ...current.clients],
                          }));
                          setSelectedClientIds((current) => [...new Set([...current, client.id])]);
                          setContactDialogView("create");
                        }}
                        onTagCreated={(tag) => {
                          setAvailableCreationOptions((current) => ({
                            ...current,
                            tags: [tag, ...current.tags],
                          }));
                          setSelectedTagIds((current) => [...new Set([...current, tag.id])]);
                          setContactDialogView("create");
                        }}
                      />
                    ) : null}
                  </>
                )}

                {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
              </div>
            </div>,
            portalTarget,
          )
        : null}
    </div>
  );
}
