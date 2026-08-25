"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContactTagAction,
  deleteContactTagAction,
  setContactTagAction,
  updateContactTagAction,
} from "./actions";
import { TAG_KIND_LABELS, type ContactTagKindName } from "@/lib/contacts/tags";

type TagRow = {
  id: string;
  label: string;
  kind: ContactTagKindName;
  assigned: boolean;
  usageCount: number;
};

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const ghost =
  "rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const danger =
  "rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-50 disabled:opacity-50";

function KindSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <select name={name} defaultValue={defaultValue ?? "CUSTOM"} className={`${inputClass} bg-white`}>
      {Object.entries(TAG_KIND_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function ContactTagsEditor({
  contactId,
  tags,
}: {
  contactId: string;
  tags: TagRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setEditingId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update tags");
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Tags</h2>
          <p className="mt-1 text-xs text-slate-500">
            Add or remove tags on this person. Edit or delete a tag to change it for every contact.
          </p>
        </div>
        <Link
          href="/settings/tags"
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
        >
          Tag list
        </Link>
      </div>

      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_10rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          data.set("contactId", contactId);
          const form = event.currentTarget;
          run(async () => {
            await createContactTagAction(data);
            form.reset();
          });
        }}
      >
        <input name="label" required placeholder="New tag name" className={inputClass} />
        <KindSelect name="kind" />
        <button type="submit" disabled={pending} className={ghost}>
          Add tag
        </button>
      </form>

      {tags.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No tags yet. Add one above or open the tag list.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {tags.map((tag) => (
            <li key={tag.id} className="flex flex-wrap items-center gap-2 p-3">
              {editingId === tag.id ? (
                <form
                  className="grid w-full gap-2 sm:grid-cols-[1fr_10rem_auto_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    run(() => updateContactTagAction(data));
                  }}
                >
                  <input type="hidden" name="tagId" value={tag.id} />
                  <input name="label" required defaultValue={tag.label} className={inputClass} />
                  <KindSelect name="kind" defaultValue={tag.kind} />
                  <button type="submit" disabled={pending} className={ghost}>
                    Save
                  </button>
                  <button type="button" className={ghost} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const data = new FormData();
                      data.set("contactId", contactId);
                      data.set("tagId", tag.id);
                      data.set("assigned", tag.assigned ? "0" : "1");
                      run(() => setContactTagAction(data));
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                      tag.assigned
                        ? "bg-slate-900 text-white"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {tag.label}
                  </button>
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                    {TAG_KIND_LABELS[tag.kind]}
                  </span>
                  <span className="flex-1" />
                  <button type="button" className={ghost} onClick={() => setEditingId(tag.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className={danger}
                    onClick={() => {
                      const extra =
                        tag.usageCount > 0
                          ? ` It will be removed from ${tag.usageCount} contact${tag.usageCount === 1 ? "" : "s"}.`
                          : "";
                      if (!confirm(`Delete the “${tag.label}” tag?${extra}`)) return;
                      const data = new FormData();
                      data.set("tagId", tag.id);
                      run(() => deleteContactTagAction(data));
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
    </section>
  );
}
