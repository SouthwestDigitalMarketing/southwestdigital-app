"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkContactToClientAction } from "../actions";

export function LinkContactForm({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: Array<{ id: string; name: string; email: string | null; company: string | null }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (contacts.length === 0) {
    return (
      <p className="mt-4 text-xs text-slate-500">
        Every active contact is already linked, or there are no contacts yet.
      </p>
    );
  }

  return (
    <form
      className="mt-4 flex flex-wrap gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            await linkContactToClientAction(data);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not link contact");
          }
        });
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <select
        name="contactId"
        required
        className="min-w-[16rem] flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">Link a contact…</option>
        {contacts.map((contact) => (
          <option key={contact.id} value={contact.id}>
            {contact.name}
            {contact.company ? ` (${contact.company})` : ""}
            {contact.email ? ` — ${contact.email}` : ""}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Linking…" : "Link"}
      </button>
      {error && <p className="w-full text-xs text-rose-700">{error}</p>}
    </form>
  );
}
