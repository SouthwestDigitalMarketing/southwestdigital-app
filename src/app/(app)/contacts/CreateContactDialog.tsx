"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContactAction } from "./actions";
import { TAG_KIND_LABELS, type ContactTagKindName } from "@/lib/contacts/tags";
import { EmailInput } from "@/components/fields/EmailInput";
import { PhoneInput } from "@/components/fields/PhoneInput";

type TagOption = {
  id: string;
  label: string;
  kind: ContactTagKindName;
};

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function CreateContactDialog({
  tags,
  clients,
  brands,
}: {
  tags: TagOption[];
  clients: Array<{ id: string; label: string }>;
  brands: Array<{ id: string; label: string }>;
}) {
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
        className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-700"
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
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                First name
                <input name="firstName" required className={inputClass} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Last name
                <input name="lastName" required className={inputClass} />
              </label>
              <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-600 sm:col-span-2">
                Email
                <div className="mt-1.5">
                  <EmailInput />
                </div>
              </label>
              <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-600 sm:col-span-2">
                Phone
                <div className="mt-1.5">
                  <PhoneInput />
                </div>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Company
                <input name="company" className={inputClass} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Role / title
                <input name="roleTitle" placeholder="Owner, bookkeeper, CPA…" className={inputClass} />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 sm:col-span-2">
                Notes
                <textarea name="notes" rows={2} className={inputClass} />
              </label>

              {clients.length > 0 && (
                <fieldset className="sm:col-span-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Clients
                  </legend>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Companies this brand serves. A person can belong to more than one.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {clients.map((client) => (
                      <label key={client.id} className="cursor-pointer">
                        <input type="checkbox" name="clientIds" value={client.id} className="peer sr-only" />
                        <span className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                          {client.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {brands.length > 0 && (
                <fieldset className="sm:col-span-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Brands
                  </legend>
                  <p className="mt-1 text-[11px] text-slate-400">
                    App tenants this person is tied to. Check every brand that applies.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {brands.map((brand) => (
                      <label key={brand.id} className="cursor-pointer">
                        <input
                          type="checkbox"
                          name="relatedBrandIds"
                          value={brand.id}
                          className="peer sr-only"
                        />
                        <span className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                          {brand.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <fieldset className="sm:col-span-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Tags
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <label key={tag.id} className="cursor-pointer">
                      <input type="checkbox" name="tagIds" value={tag.id} className="peer sr-only" />
                      <span className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white">
                        {tag.label}
                        <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">
                          {TAG_KIND_LABELS[tag.kind]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {error && (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 sm:col-span-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-700 disabled:opacity-50 sm:col-span-2"
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
