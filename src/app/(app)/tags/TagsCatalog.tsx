"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createContactTagAction,
  deleteContactTagAction,
  saveTagAutomationAction,
  updateContactTagAction,
} from "../contacts/actions";
import { setCatalogServicesForTagAction } from "../services/actions";
import { TAG_KIND_LABELS, type ContactTagKindName } from "@/lib/contacts/tags";

type TagRow = {
  id: string;
  label: string;
  kind: ContactTagKindName;
  usageCount: number;
  serviceCount: number;
  pipelineId: string | null;
};

type CatalogServiceRow = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  tagIds: string[];
};

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const ghost =
  "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const danger =
  "rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-50 disabled:opacity-50";
const primary =
  "rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-700 disabled:opacity-50";

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

export function TagsCatalog({
  tags,
  pipelines,
  services,
}: {
  tags: TagRow[];
  pipelines: Array<{ id: string; name: string }>;
  services: CatalogServiceRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managingServicesTagId, setManagingServicesTagId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setEditingId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save tags");
      }
    });
  }

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const form = event.currentTarget;
          run(async () => {
            await createContactTagAction(data);
            form.reset();
          });
        }}
      >
        <input name="label" required placeholder="New tag name" className={inputClass} />
        <KindSelect name="kind" />
        <button type="submit" disabled={pending} className={primary}>
          Add tag
        </button>
      </form>

      {tags.length === 0 ? (
        <p className="text-sm text-slate-400">No tags yet. Add the first one above.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tag
                </th>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kind
                </th>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contacts
                </th>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pipeline
                </th>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tags.map((tag) => (
                <Fragment key={tag.id}>
                <tr>
                  {editingId === tag.id ? (
                    <td colSpan={5} className="px-4 py-3">
                      <form
                        className="grid gap-2 sm:grid-cols-[1fr_10rem_auto_auto]"
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
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-slate-900">{tag.label}</td>
                      <td className="px-4 py-3 text-slate-600">{TAG_KIND_LABELS[tag.kind]}</td>
                      <td className="px-4 py-3 text-slate-600">{tag.usageCount}</td>
                      <td className="px-4 py-3">
                        <form
                          className="flex items-center gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const data = new FormData(event.currentTarget);
                            run(() => saveTagAutomationAction(data));
                          }}
                        >
                          <input type="hidden" name="tagId" value={tag.id} />
                          <select
                            name="pipelineId"
                            defaultValue={tag.pipelineId ?? ""}
                            className={`${inputClass} bg-white`}
                          >
                            <option value="">None yet</option>
                            {pipelines.map((pipeline) => (
                              <option key={pipeline.id} value={pipeline.id}>
                                {pipeline.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" disabled={pending} className={ghost}>
                            Save
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={ghost} onClick={() => setEditingId(tag.id)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            aria-expanded={managingServicesTagId === tag.id}
                            onClick={() => setManagingServicesTagId((current) => (current === tag.id ? null : tag.id))}
                            className={ghost}
                          >
                            Services ({tag.serviceCount})
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
                              if (!confirm(`Delete the "${tag.label}" tag?${extra}`)) return;
                              const data = new FormData();
                              data.set("tagId", tag.id);
                              run(() => deleteContactTagAction(data));
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                {managingServicesTagId === tag.id ? (
                  <tr>
                    <td colSpan={5} className="bg-slate-50 px-4 py-4">
                      <form
                        className="rounded-lg border border-slate-200 bg-white p-4"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          run(async () => {
                            await setCatalogServicesForTagAction(data);
                            setManagingServicesTagId(null);
                          });
                        }}
                      >
                        <input type="hidden" name="tagId" value={tag.id} />
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div>
                            <h2 className="font-semibold text-slate-900">Apply “{tag.label}” to services</h2>
                            <p className="mt-1 text-xs text-slate-500">
                              Select every catalogue service that should have this tag, then save once.
                            </p>
                          </div>
                          <span className="text-xs text-slate-500">{services.length} services</span>
                        </div>
                        {services.length === 0 ? (
                          <p className="mt-4 text-sm text-slate-500">No catalogue services exist yet.</p>
                        ) : (
                          <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                            {services.map((service) => (
                              <label key={service.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  name="serviceIds"
                                  value={service.id}
                                  defaultChecked={service.tagIds.includes(tag.id)}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-slate-900">{service.name}</span>
                                  <span className="block truncate text-xs text-slate-500">
                                    {service.active ? service.code || "Active" : `${service.code ? `${service.code} · ` : ""}Archived`}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="submit" disabled={pending} className={primary}>
                            {pending ? "Saving…" : "Save service assignments"}
                          </button>
                          <button type="button" disabled={pending} className={ghost} onClick={() => setManagingServicesTagId(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pipelines.length === 0 ? (
        <p className="text-xs text-slate-500">
          No pipelines exist yet. Tagging still works; pipeline placement can be wired later.
        </p>
      ) : null}

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
