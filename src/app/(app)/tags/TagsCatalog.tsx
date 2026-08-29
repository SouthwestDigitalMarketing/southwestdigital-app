"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const managingServicesTag = tags.find((tag) => tag.id === managingServicesTagId) ?? null;
  const savedServiceIds = managingServicesTag
    ? services.filter((service) => service.tagIds.includes(managingServicesTag.id)).map((service) => service.id)
    : [];
  const serviceAssignmentsDirty =
    selectedServiceIds.length !== savedServiceIds.length ||
    selectedServiceIds.some((id) => !savedServiceIds.includes(id));

  function openServiceManager(tagId: string) {
    setError(null);
    setSelectedServiceIds(
      services.filter((service) => service.tagIds.includes(tagId)).map((service) => service.id),
    );
    setManagingServicesTagId(tagId);
  }

  function closeServiceManager() {
    if (serviceAssignmentsDirty && !confirm("Discard unsaved service assignments?")) return;
    setManagingServicesTagId(null);
  }

  useEffect(() => {
    if (!managingServicesTagId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (serviceAssignmentsDirty && !confirm("Discard unsaved service assignments?")) return;
      setManagingServicesTagId(null);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [managingServicesTagId, serviceAssignmentsDirty]);

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
    <>
      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tag management</p>
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
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tag list</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-2 text-sm font-semibold normal-case text-slate-700">
                  Tag
                </th>
                <th className="px-4 py-2 text-sm font-semibold normal-case text-slate-700">
                  Kind
                </th>
                <th className="px-4 py-2 text-sm font-semibold normal-case text-slate-700">
                  Contacts
                </th>
                <th className="px-4 py-2 text-sm font-semibold normal-case text-slate-700">
                  Pipeline
                </th>
                <th className="px-4 py-2 text-sm font-semibold normal-case text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tags.map((tag) => (
                <tr key={tag.id}>
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
                            onClick={() => openServiceManager(tag.id)}
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
              ))}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {pipelines.length === 0 ? (
        <p className="text-xs text-slate-500">
          No pipelines exist yet. Tagging still works; pipeline placement can be wired later.
        </p>
      ) : null}

        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
      </div>

      {managingServicesTag ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="services-dialog-title"
          aria-describedby="services-dialog-description"
          className="fixed inset-0 z-50 flex min-h-0 flex-col bg-slate-50"
        >
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              run(async () => {
                await setCatalogServicesForTagAction(data);
                setManagingServicesTagId(null);
              });
            }}
          >
            <input type="hidden" name="tagId" value={managingServicesTag.id} />

            <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-8 sm:py-5">
              <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
                <div>
                  <h2 id="services-dialog-title" className="text-xl font-semibold text-slate-950 sm:text-2xl">
                    Apply “{managingServicesTag.label}” to services
                  </h2>
                  <p id="services-dialog-description" className="mt-1 text-sm text-slate-500">
                    Select every catalogue service that should have this tag, then save once.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  autoFocus
                  aria-label="Close service assignments"
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={closeServiceManager}
                >
                  Close
                </button>
              </div>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
              <div className="mx-auto max-w-7xl">
                {error ? (
                  <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </p>
                ) : null}
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-700">Service catalogue</p>
                  <span className="text-sm text-slate-500">
                    {selectedServiceIds.length} selected · {services.length} services
                  </span>
                </div>

                {services.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                    No catalogue services exist yet.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {services.map((service) => (
                      <label
                        key={service.id}
                        className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          name="serviceIds"
                          value={service.id}
                          checked={selectedServiceIds.includes(service.id)}
                          onChange={(event) => {
                            setSelectedServiceIds((current) =>
                              event.target.checked
                                ? [...current, service.id]
                                : current.filter((id) => id !== service.id),
                            );
                          }}
                          className="h-4 w-4 shrink-0 rounded border-slate-300"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">{service.name}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {service.active
                              ? service.code || "Active"
                              : `${service.code ? `${service.code} · ` : ""}Archived`}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </main>

            <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] sm:px-8">
              <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
                <button type="submit" disabled={pending || !serviceAssignmentsDirty} className={primary}>
                  {pending ? "Saving…" : serviceAssignmentsDirty ? "Save service assignments" : "Assignments saved"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className={ghost}
                  onClick={closeServiceManager}
                >
                  Cancel
                </button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}
    </>
  );
}
