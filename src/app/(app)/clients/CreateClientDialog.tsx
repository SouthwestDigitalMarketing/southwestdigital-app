"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClientAction } from "./actions";

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function CreateClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-700"
      >
        <Plus size={13} />
        Add Client
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Add client</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              A client is a company this brand works with. People belong on Contacts.
            </p>

            <form
              ref={formRef}
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                const data = new FormData(event.currentTarget);
                startTransition(async () => {
                  try {
                    await createClientAction(data);
                    formRef.current?.reset();
                    setOpen(false);
                    router.refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not create client");
                  }
                });
              }}
            >
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Client name
                <input name="name" required placeholder="Acme LLC" className={inputClass} />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Code (optional)
                <input name="code" placeholder="ACME" className={inputClass} />
              </label>
              {error && (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save client"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
