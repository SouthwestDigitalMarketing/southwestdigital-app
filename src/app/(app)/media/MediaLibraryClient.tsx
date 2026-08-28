"use client";

import { useState, useTransition } from "react";
import { Image as ImageIcon, Plus, Trash2, Video, X, Check, Pencil } from "lucide-react";
import { createBrandMediaAction, deleteBrandMediaAction, updateBrandMediaAction } from "./actions";

type MediaItem = {
  id: string;
  name: string;
  type: string;
  url: string;
};

export default function MediaLibraryClient({ items: initialItems }: { items: MediaItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createBrandMediaAction(formData);
        setShowAddForm(false);
        // Optimistic: server revalidates, but we also append locally for speed
        const name = formData.get("name") as string;
        const type = formData.get("type") as string;
        const url = formData.get("url") as string;
        setItems((prev) => [...prev, { id: `tmp-${Date.now()}`, name, type, url }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add item.");
      }
    });
  }

  function handleUpdate(id: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await updateBrandMediaAction(id, formData);
        const name = formData.get("name") as string;
        const url = formData.get("url") as string;
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, name, url } : item)));
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save changes.");
      }
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteBrandMediaAction(id);
        setItems((prev) => prev.filter((item) => item.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete item.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {items.length === 0 && !showAddForm && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Media library</p>
          <p className="mt-3 text-sm font-medium text-slate-500">No media saved yet.</p>
          <p className="mt-1 text-sm text-slate-400">Add videos and images to use in proposal intros.</p>
        </div>
      )}

      {items.map((item) =>
        editingId === item.id ? (
          <EditItemForm
            key={item.id}
            item={item}
            isPending={isPending}
            onSave={(formData) => handleUpdate(item.id, formData)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <MediaItemRow
            key={item.id}
            item={item}
            isPending={isPending}
            onEdit={() => setEditingId(item.id)}
            onDelete={() => handleDelete(item.id)}
          />
        ),
      )}

      {showAddForm ? (
        <AddItemForm
          isPending={isPending}
          onSubmit={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
        >
          <Plus className="h-4 w-4" />
          Add media
        </button>
      )}
    </div>
  );
}

function MediaItemRow({
  item,
  isPending,
  onEdit,
  onDelete,
}: {
  item: MediaItem;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          item.type === "video" ? "bg-brandnavy-50 text-brandnavy" : "bg-amber-50 text-amber-700"
        }`}
      >
        {item.type === "video" ? <Video className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {item.type === "video" ? "Video" : "Image"}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{item.name}</p>
        <p className="truncate text-xs text-slate-400">{item.url}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={isPending}
          className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:opacity-40"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="rounded-lg border border-slate-200 p-2 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AddItemForm({
  isPending,
  onSubmit,
  onCancel,
}: {
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="rounded-xl border border-brandnavy bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New media item</p>
        <button type="button" onClick={onCancel} className="rounded p-1 text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <MediaFormFields />
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-brandnavy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandnavy/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </form>
  );
}

function EditItemForm({
  item,
  isPending,
  onSave,
  onCancel,
}: {
  item: MediaItem;
  isPending: boolean;
  onSave: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(new FormData(e.currentTarget));
      }}
      className="rounded-xl border border-brandnavy bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit media item</p>
        <button type="button" onClick={onCancel} className="rounded p-1 text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <MediaFormFields defaultName={item.name} defaultType={item.type} defaultUrl={item.url} />
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg bg-brandnavy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandnavy/90 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Save
        </button>
      </div>
    </form>
  );
}

function MediaFormFields({
  defaultName = "",
  defaultType = "video",
  defaultUrl = "",
}: {
  defaultName?: string;
  defaultType?: string;
  defaultUrl?: string;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-600">Name</label>
        <input
          name="name"
          type="text"
          required
          defaultValue={defaultName}
          placeholder="e.g. Intro walkthrough"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600">Type</label>
        <select
          name="type"
          defaultValue={defaultType}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
        >
          <option value="video">Video</option>
          <option value="image">Image</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600">URL</label>
        <input
          name="url"
          type="url"
          required
          defaultValue={defaultUrl}
          placeholder="https://…"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
        />
      </div>
    </div>
  );
}
