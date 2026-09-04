"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContactAction } from "./actions";
import {
  ContactCreateFields,
  type ContactCreationOptions,
} from "@/components/contacts/ContactCreateFields";

export function CreateContactDialog({
  tags,
  clients,
  brands,
}: ContactCreationOptions) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

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
        onClick={() => setOpen(true)}
        className="ui-action-primary flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition"
      >
        <Plus size={13} />
        Add Contact
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-x-hidden overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add contact</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
              <ContactCreateFields
                tags={tags}
                clients={clients}
                brands={brands}
                autoFocusFirstName
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
          </div>
        </div>
      )}
    </>
  );
}
