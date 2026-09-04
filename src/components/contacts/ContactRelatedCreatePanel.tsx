"use client";

import { useState, useTransition } from "react";
import { createClientAction } from "@/app/(app)/clients/actions";
import { createContactTagAction } from "@/app/(app)/contacts/actions";
import { TAG_KIND_LABELS, type ContactTagKindName } from "@/lib/contacts/tags";

type CreatedClient = { id: string; label: string };
type CreatedTag = { id: string; label: string; kind: ContactTagKindName };

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function ContactRelatedCreatePanel({
  view,
  onBack,
  onClientCreated,
  onTagCreated,
}: {
  view: "client" | "tag";
  onBack: () => void;
  onClientCreated: (client: CreatedClient) => void;
  onTagCreated: (tag: CreatedTag) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        if (view === "client") {
          onClientCreated(await createClientAction(data));
        } else {
          onTagCreated(await createContactTagAction(data));
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `Could not create ${view === "client" ? "client" : "tag"}.`,
        );
      }
    });
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={submit}>
      <p className="text-sm text-slate-500">
        {view === "client"
          ? "A client is a company this brand works with. The new client will be selected for this contact."
          : "Create a reusable tag for this brand. The new tag will be selected for this contact."}
      </p>

      {view === "client" ? (
        <>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Client name
            <input
              name="name"
              required
              autoFocus
              autoComplete="organization"
              placeholder="Acme LLC"
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Code (optional)
            <input name="code" placeholder="ACME" className={inputClass} />
          </label>
        </>
      ) : (
        <>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Tag name
            <input name="label" required autoFocus placeholder="New tag name" className={inputClass} />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Tag type
            <select name="kind" defaultValue="CUSTOM" className={`${inputClass} bg-white`}>
              {Object.entries(TAG_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700" aria-live="polite">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="ui-action-primary rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Saving…" : `Save ${view}`}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onBack}
          className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          Back
        </button>
      </div>
    </form>
  );
}
