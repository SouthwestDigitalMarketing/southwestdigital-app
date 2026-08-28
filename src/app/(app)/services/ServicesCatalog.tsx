"use client";

import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCatalogServiceAction,
  deleteCatalogServiceAction,
  setCatalogServiceActiveAction,
  updateCatalogServiceAction,
} from "./actions";
import { TAG_KIND_LABELS, type ContactTagKindName } from "@/lib/contacts/tags";

export type ServiceTag = {
  id: string;
  label: string;
  kind: ContactTagKindName;
  key?: string;
};

export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  service: string;
  tagId: string | null;
  tags: ServiceTag[];
  code: string | null;
  cardLabel: string | null;
  clientBenefit: string | null;
  internalDescription: string | null;
  defaultInclusion: string | null;
  priority: number;
  realEstateSpecific: boolean;
  active: boolean;
  packageCount: number;
};

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-base text-slate-800 focus:border-slate-500 focus:outline-none";
const ghost =
  "inline-flex h-9 cursor-pointer items-center rounded-full border border-slate-300 bg-white px-3 text-base font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
const primary =
  "inline-flex h-9 cursor-pointer items-center rounded-full bg-slate-900 px-4 text-base font-semibold text-white hover:bg-slate-700 disabled:opacity-50";

export function ServicesCatalog({
  services,
  tags,
  archived,
}: {
  services: ServiceRow[];
  tags: ServiceTag[];
  archived: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setEditingId(null);
        setCreating(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save the service.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-5">
          <h2 className="text-lg font-semibold text-slate-900">Service catalogue</h2>
          <div className="flex items-center gap-3 text-base font-medium">
            <span className={archived ? "text-slate-400" : "text-slate-900"}>Current</span>
            <button
              type="button"
              role="switch"
              aria-checked={archived}
              aria-label="Show archived services"
              onClick={() => router.push(archived ? "/services" : "/services?archived=1")}
              className="relative h-7 w-12 cursor-pointer rounded-full transition-colors"
              style={{ backgroundColor: archived ? "var(--brand-dark, var(--brand-primary))" : "#64748b" }}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full border border-slate-300 bg-white shadow-sm transition-transform ${archived ? "left-6" : "left-1"}`} />
            </button>
            <span className={archived ? "text-slate-900" : "text-slate-400"}>Archived</span>
          </div>
        </div>
        {archived ? null : (
          <button type="button" onClick={() => { setCreating(true); setEditingId(null); }} className={primary}>
            Add service
          </button>
        )}
      </div>

      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-base text-rose-800">{error}</p> : null}

      {creating ? (
        <ServiceForm
          tags={tags}
          pending={pending}
          onCancel={() => setCreating(false)}
          onSubmit={(data) => run(async () => createCatalogServiceAction(data))}
        />
      ) : null}

      {services.length === 0 && !creating ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service list</p>
          <p className="mt-3 text-base text-slate-500">
            {archived ? "No archived services yet." : "No services in the catalogue yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service list</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3.5 text-sm font-semibold normal-case text-slate-700">Service Title</th>
                <th className="px-5 py-3.5 text-sm font-semibold normal-case text-slate-700">Description</th>
                <th className="px-5 py-3.5 text-sm font-semibold normal-case text-slate-700">Tags</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((service, index) =>
                editingId === service.id ? (
                  <tr key={service.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td colSpan={4} className="px-5 py-4">
                      <ServiceForm
                        service={service}
                        tags={tags}
                        pending={pending}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(data) => {
                          data.set("id", service.id);
                          run(async () => updateCatalogServiceAction(data));
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={service.id} className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-slate-50`}>
                    <td className="px-5 py-4 font-bold text-slate-900">{service.name}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {service.clientBenefit || service.internalDescription || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      {service.tags.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {service.tags.map((tag) => (
                            <span key={tag.id} className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={`Edit ${service.name}`}
                          title="Edit"
                          onClick={() => { setEditingId(service.id); setCreating(false); }}
                          className="cursor-pointer rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          aria-label={service.active ? `Archive ${service.name}` : `Unarchive ${service.name}`}
                          title={service.active ? "Archive" : "Unarchive"}
                          onClick={() => {
                            const data = new FormData();
                            data.set("id", service.id);
                            data.set("active", service.active ? "false" : "true");
                            run(async () => setCatalogServiceActiveAction(data));
                          }}
                          className="cursor-pointer rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                        >
                          {service.active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          disabled={pending || service.packageCount > 0}
                          aria-label={`Delete ${service.name}`}
                          title={service.packageCount > 0 ? "Used on a package — archive instead" : "Delete"}
                          onClick={() => {
                            const data = new FormData();
                            data.set("id", service.id);
                            run(async () => deleteCatalogServiceAction(data));
                          }}
                          className="cursor-pointer rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceForm({
  service,
  tags,
  pending,
  onCancel,
  onSubmit,
}: {
  service?: ServiceRow;
  tags: ServiceTag[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: FormData) => void;
}) {
  const tagsByKind = (Object.keys(TAG_KIND_LABELS) as ContactTagKindName[])
    .map((kind) => ({ kind, label: TAG_KIND_LABELS[kind], tags: tags.filter((tag) => tag.kind === kind) }))
    .filter((group) => group.tags.length > 0);
  return (
    <form
      className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {service ? "Edit service" : "New service"}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Name
          <input name="name" required defaultValue={service?.name ?? ""} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Code
          <input name="code" defaultValue={service?.code ?? ""} placeholder="Optional unique code" className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600 md:col-span-2">
          Client benefit
          <input name="clientBenefit" defaultValue={service?.clientBenefit ?? ""} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Card label
          <input name="cardLabel" defaultValue={service?.cardLabel ?? ""} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600">
          Priority
          <input name="priority" type="number" min={0} step={1} defaultValue={service?.priority ?? 500} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-600 md:col-span-2">
          Internal description
          <textarea name="internalDescription" rows={2} defaultValue={service?.internalDescription ?? ""} className={inputClass} />
        </label>
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium text-slate-600">
          Tags{" "}
          <span className="font-normal text-slate-500">
            Managed on the{" "}
            <Link href="/tags" className="underline hover:text-slate-800">
              Tags
            </Link>{" "}
            page. Use the Real estate tag for real-estate-only services.
          </span>
        </p>
        {tagsByKind.length === 0 ? (
          <p className="text-sm text-slate-500">No tags yet. Add them on the Tags page.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tagsByKind.map((group) => (
              <fieldset key={group.kind} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</legend>
                <div className="flex flex-wrap gap-2 py-1">
                  {group.tags.map((tag) => (
                    <label key={tag.id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-2.5 py-1 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="tagIds"
                        value={tag.id}
                        defaultChecked={service?.tags.some((assigned) => assigned.id === tag.id) ?? false}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {tag.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Saving…" : service ? "Save" : "Add service"}
        </button>
        <button type="button" disabled={pending} onClick={onCancel} className={ghost}>
          Cancel
        </button>
      </div>
    </form>
  );
}
