"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateContactAction } from "../actions";
import { EmailInput } from "@/components/fields/EmailInput";
import { PhoneInput } from "@/components/fields/PhoneInput";

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function ContactEditor({
  contact,
}: {
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    roleTitle: string;
    notes: string;
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
            await updateContactAction(data);
            setSaved(true);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save contact");
          }
        });
      }}
    >
      <h2 className="text-base font-semibold text-slate-800">Details</h2>
      <input type="hidden" name="contactId" value={contact.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          First name
          <input name="firstName" required defaultValue={contact.firstName} className={inputClass} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Last name
          <input name="lastName" required defaultValue={contact.lastName} className={inputClass} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Email
          <div className="mt-1.5">
            <EmailInput defaultValue={contact.email} />
          </div>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Phone
          <div className="mt-1.5">
            <PhoneInput defaultValue={contact.phone} />
          </div>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Company
          <input name="company" defaultValue={contact.company} className={inputClass} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Role / title
          <input name="roleTitle" defaultValue={contact.roleTitle} className={inputClass} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 sm:col-span-2">
          Notes
          <textarea name="notes" rows={3} defaultValue={contact.notes} className={inputClass} />
        </label>
      </div>
      {contact.isActive ? <input type="hidden" name="isActive" value="1" /> : null}
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      {saved && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Contact saved.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="ui-action-primary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Link
          href="/contacts"
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
        >
          Exit
        </Link>
      </div>
    </form>
  );
}
