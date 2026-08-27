"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateClientAction } from "../actions";
import { EmailInput } from "@/components/fields/EmailInput";
import { PhoneInput } from "@/components/fields/PhoneInput";

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function ClientEditor({
  client,
}: {
  client: {
    id: string;
    name: string;
    code: string;
    businessLegalName: string;
    entityType: string;
    email: string;
    phone: string;
    isActive: boolean;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            await updateClientAction(data);
            setSaved(true);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save client");
          }
        });
      }}
    >
      <h2 className="text-base font-semibold text-slate-800">Details</h2>
      <input type="hidden" name="clientId" value={client.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Client name
          <input name="name" required defaultValue={client.name} className={inputClass} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Code
          <input name="code" defaultValue={client.code} className={inputClass} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Legal name
          <input
            name="businessLegalName"
            defaultValue={client.businessLegalName}
            className={inputClass}
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Entity type
          <input name="entityType" defaultValue={client.entityType} className={inputClass} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Email
          <div className="mt-1.5">
            <EmailInput defaultValue={client.email} />
          </div>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Phone
          <div className="mt-1.5">
            <PhoneInput name="primaryContactPhone" defaultValue={client.phone} />
          </div>
        </label>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="isActive"
          value="1"
          defaultChecked={client.isActive}
          className="h-4 w-4 rounded border-slate-300"
        />
        Active
      </label>
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      {saved && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Client saved.</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
