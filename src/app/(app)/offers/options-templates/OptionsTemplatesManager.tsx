"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Copy, Pencil, Plus, Star, StarOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import {
  archiveOptionsTemplateAction,
  createOptionsTemplateFromCatalogAction,
  deleteOptionsTemplateAction,
  duplicateOptionsTemplateAction,
  restoreOptionsTemplateAction,
  setDefaultOptionsTemplateAction,
  updateOptionsTemplateAction,
  type OptionsTemplateListItem,
} from "./actions";

type EditingState = {
  id: string;
  name: string;
  description: string;
};

export default function OptionsTemplatesManager({
  templates,
}: {
  templates: OptionsTemplateListItem[];
}) {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = templates.filter((t) =>
    showArchived ? t.archivedAt !== null : t.archivedAt === null,
  );

  function run(action: () => Promise<unknown>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onSuccess?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleSaveEdit() {
    if (!editing) return;
    const snapshot = editing;
    run(
      () =>
        updateOptionsTemplateAction(snapshot.id, {
          name: snapshot.name,
          description: snapshot.description,
        }),
      () => setEditing(null),
    );
  }

  function handleDelete(id: string, name: string) {
    if (typeof window !== "undefined" && !window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) {
      return;
    }
    run(() => deleteOptionsTemplateAction(id));
  }

  function handleCreateNew() {
    setError(null);
    startTransition(async () => {
      try {
        const id = await createOptionsTemplateFromCatalogAction();
        router.refresh();
        setEditing({ id, name: "New options template", description: "" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="agreements-readable">
      <h1 className="text-xl font-semibold text-slate-900">Options templates</h1>
      <div className="mt-3 mb-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleCreateNew}
          disabled={isPending}
          className="ui-action-primary inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> New template
        </button>
        <div className="flex items-center gap-3 text-base font-medium text-slate-700">
          <span className={!showArchived ? "text-slate-900" : "text-slate-500"}>Current</span>
          <button
            type="button"
            role="switch"
            aria-checked={showArchived}
            aria-label="Show archived templates"
            onClick={() => setShowArchived((v) => !v)}
            className="ui-toggle-switch"
          >
            <span className="ui-toggle-switch-thumb" />
          </button>
          <span className={showArchived ? "text-slate-900" : "text-slate-500"}>Archived</span>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Default</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {showArchived
                    ? "No archived templates."
                    : "No templates yet. Save one from the Options step of any offer."}
                </td>
              </tr>
            ) : (
              visible.map((template) => {
                const isDefault = template.defaultForProductKind !== null;
                return (
                  <tr key={template.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold text-slate-900">{template.name}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      {template.description ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <Star className="h-3 w-3" /> Default
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-500">
                      {new Date(template.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Edit name/description"
                          disabled={isPending || template.archivedAt !== null}
                          onClick={() =>
                            setEditing({
                              id: template.id,
                              name: template.name,
                              description: template.description ?? "",
                            })
                          }
                          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Duplicate"
                          disabled={isPending}
                          onClick={() => run(() => duplicateOptionsTemplateAction(template.id))}
                          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {template.archivedAt === null ? (
                          <button
                            type="button"
                            title={isDefault ? "Unset default" : "Set as default"}
                            disabled={isPending}
                            onClick={() =>
                              run(() =>
                                setDefaultOptionsTemplateAction(template.id, !isDefault),
                              )
                            }
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >
                            {isDefault ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                          </button>
                        ) : null}
                        {template.archivedAt === null ? (
                          <button
                            type="button"
                            title="Archive"
                            disabled={isPending || isDefault}
                            onClick={() => run(() => archiveOptionsTemplateAction(template.id))}
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Restore"
                            disabled={isPending}
                            onClick={() => run(() => restoreOptionsTemplateAction(template.id))}
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </button>
                        )}
                        {template.archivedAt !== null ? (
                          <button
                            type="button"
                            title="Delete permanently"
                            disabled={isPending}
                            onClick={() => handleDelete(template.id, template.name)}
                            className="rounded-md p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <Modal open onClose={() => setEditing(null)} label="Edit template">
          <div className="space-y-4 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Edit template</h2>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Name</span>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                maxLength={120}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">Description</span>
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="mt-1 h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                maxLength={500}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isPending || !editing.name.trim()}
                className="ui-action-primary rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
