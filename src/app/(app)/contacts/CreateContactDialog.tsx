"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContactAction } from "./actions";
import {
  ContactCreateFields,
  type ContactCreationOptions,
} from "@/components/contacts/ContactCreateFields";
import { ContactRelatedCreatePanel } from "@/components/contacts/ContactRelatedCreatePanel";
import { Modal } from "@/components/Modal";

type CreateDialogView = "contact" | "client" | "tag";

export function CreateContactDialog({
  tags,
  clients,
  brands,
}: ContactCreationOptions) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CreateDialogView>("contact");
  const [options, setOptions] = useState<ContactCreationOptions>({ tags, clients, brands });
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function openContactDialog() {
    setOptions({ tags, clients, brands });
    setSelectedClientIds([]);
    setSelectedTagIds([]);
    setView("contact");
    setError(null);
    setOpen(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await createContactAction(data);
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create contact");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openContactDialog}
        className="ui-action-primary flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition"
      >
        <Plus size={13} />
        Add Contact
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} labelledBy="create-contact-dialog-title" className="max-w-2xl" busy={pending}>
          <div
            className="w-full min-w-0 bg-white p-4 sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 id="create-contact-dialog-title" className="text-xl font-semibold tracking-tight text-slate-900">
                {view === "contact" ? "Add contact" : view === "client" ? "Add client" : "Add tag"}
              </h2>
              <button
                type="button"
                aria-label="Close add contact"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className={`${view === "contact" ? "" : "hidden"} mt-5 grid gap-4 sm:grid-cols-2`}
            >
              <ContactCreateFields
                {...options}
                autoFocusFirstName
                defaultSelectedClientIds={selectedClientIds}
                defaultSelectedTagIds={selectedTagIds}
                onAddClient={() => setView("client")}
                onAddTag={() => setView("tag")}
              />

              {error && (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 sm:col-span-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="ui-action-primary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition disabled:opacity-50 sm:col-span-2"
              >
                {pending ? "Saving…" : "Save contact"}
              </button>
            </form>

            {view !== "contact" ? (
              <ContactRelatedCreatePanel
                view={view}
                onBack={() => setView("contact")}
                onClientCreated={(client) => {
                  setOptions((current) => ({
                    ...current,
                    clients: [client, ...current.clients],
                  }));
                  setSelectedClientIds((current) => [...new Set([...current, client.id])]);
                  setView("contact");
                }}
                onTagCreated={(tag) => {
                  setOptions((current) => ({
                    ...current,
                    tags: [tag, ...current.tags],
                  }));
                  setSelectedTagIds((current) => [...new Set([...current, tag.id])]);
                  setView("contact");
                }}
              />
            ) : null}
          </div>
        </Modal>
      )}
    </>
  );
}
