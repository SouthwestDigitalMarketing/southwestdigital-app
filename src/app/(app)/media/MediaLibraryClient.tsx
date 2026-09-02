"use client";

import { useMemo, useState, useTransition } from "react";
import { Folder, FolderPlus, Pencil, Plus, Trash2, Video, X, Check } from "lucide-react";
import {
  createBrandMediaAction,
  createBrandMediaFolderAction,
  deleteBrandMediaAction,
  deleteBrandMediaFolderAction,
  renameBrandMediaFolderAction,
  updateBrandMediaAction,
} from "./actions";

type MediaFolder = {
  id: string;
  name: string;
};

type MediaItem = {
  id: string;
  name: string;
  type: string;
  url: string;
  folderId: string | null;
};

type FolderFilter = "all" | "unfiled" | string;

export default function MediaLibraryClient({
  items: initialItems,
  folders: initialFolders,
}: {
  items: MediaItem[];
  folders: MediaFolder[];
}) {
  const [items, setItems] = useState(initialItems);
  const [folders, setFolders] = useState(initialFolders);
  const [filter, setFilter] = useState<FolderFilter>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unfiled") return items.filter((item) => !item.folderId);
    return items.filter((item) => item.folderId === filter);
  }, [filter, items]);

  const currentFolderId = filter === "all" || filter === "unfiled" ? "" : filter;

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createBrandMediaAction(formData);
        const name = formData.get("name") as string;
        const type = formData.get("type") as string;
        const url = formData.get("url") as string;
        const folderId = (formData.get("folderId") as string) || null;
        setItems((prev) => [...prev, { id: `tmp-${Date.now()}`, name, type, url, folderId }]);
        setShowAddForm(false);
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
        const folderId = (formData.get("folderId") as string) || null;
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, name, url, folderId } : item)));
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

  function handleCreateFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    const formData = new FormData();
    formData.set("name", name);
    setError(null);
    startTransition(async () => {
      try {
        const folder = await createBrandMediaFolderAction(formData);
        setFolders((prev) => [...prev, folder]);
        setFilter(folder.id);
        setNewFolderName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create folder.");
      }
    });
  }

  function handleRenameFolder(id: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await renameBrandMediaFolderAction(id, formData);
        const name = formData.get("name") as string;
        setFolders((prev) => prev.map((folder) => (folder.id === id ? { ...folder, name } : folder)));
        setRenamingFolderId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename folder.");
      }
    });
  }

  function handleDeleteFolder(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteBrandMediaFolderAction(id);
        setFolders((prev) => prev.filter((folder) => folder.id !== id));
        setItems((prev) => prev.map((item) => (item.folderId === id ? { ...item, folderId: null } : item)));
        if (filter === id) setFilter("unfiled");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete folder.");
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="flex min-h-[28rem]">
        <aside className="w-56 shrink-0 border-r border-slate-200 p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Folders</p>
          <FolderNavButton selected={filter === "all"} onClick={() => setFilter("all")} label="All media" />
          <FolderNavButton selected={filter === "unfiled"} onClick={() => setFilter("unfiled")} label="Unfiled" />
          {folders.map((folder) =>
            renamingFolderId === folder.id ? (
              <form
                key={folder.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  handleRenameFolder(folder.id, new FormData(event.currentTarget));
                }}
                className="mb-1 flex items-center gap-1"
              >
                <input
                  name="name"
                  defaultValue={folder.name}
                  autoFocus
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <button type="submit" className="rounded p-1 text-slate-600 hover:text-slate-900" title="Save">
                  <Check className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setRenamingFolderId(null)} className="rounded p-1 text-slate-400" title="Cancel">
                  <X className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <div key={folder.id} className="group mb-1 flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <FolderNavButton selected={filter === folder.id} onClick={() => setFilter(folder.id)} label={folder.name} />
                </div>
                <button
                  type="button"
                  onClick={() => setRenamingFolderId(folder.id)}
                  className="hidden rounded p-1 text-slate-400 hover:text-slate-700 group-hover:block"
                  title="Rename folder"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(folder.id)}
                  disabled={isPending}
                  className="hidden rounded p-1 text-slate-400 hover:text-rose-600 group-hover:block"
                  title="Delete folder"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ),
          )}
          <form onSubmit={handleCreateFolder} className="mt-3 flex items-center gap-1">
            <input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="New folder"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={isPending || !newFolderName.trim()}
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-40"
              title="Add folder"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          </form>
        </aside>

        <div className="min-w-0 flex-1 p-4">
          {visibleItems.length === 0 && !showAddForm ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-500">No media in this folder.</p>
              <p className="mt-1 text-sm text-slate-400">Add a video or image to use in proposal intros.</p>
            </div>
          ) : null}

          <div className="space-y-3">
            {visibleItems.map((item) =>
              editingId === item.id ? (
                <EditItemForm
                  key={item.id}
                  item={item}
                  folders={folders}
                  isPending={isPending}
                  onSave={(formData) => handleUpdate(item.id, formData)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <MediaItemRow
                  key={item.id}
                  item={item}
                  folderName={folders.find((folder) => folder.id === item.folderId)?.name ?? null}
                  isPending={isPending}
                  onEdit={() => setEditingId(item.id)}
                  onDelete={() => handleDelete(item.id)}
                />
              ),
            )}

            {showAddForm ? (
              <AddItemForm
                folders={folders}
                defaultFolderId={currentFolderId}
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
        </div>
      </div>
    </div>
  );
}

function FolderNavButton({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium ${
        selected ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Folder className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function MediaItemRow({
  item,
  folderName,
  isPending,
  onEdit,
  onDelete,
}: {
  item: MediaItem;
  folderName: string | null;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      {item.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brandnavy-50 text-brandnavy">
          <Video className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {item.type === "video" ? "Video" : "Image"}
          {folderName ? ` · ${folderName}` : ""}
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
  folders,
  defaultFolderId,
  isPending,
  onSubmit,
  onCancel,
}: {
  folders: MediaFolder[];
  defaultFolderId: string;
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
      className="rounded-xl border border-brandnavy bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New media item</p>
        <button type="button" onClick={onCancel} className="rounded p-1 text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <MediaFormFields folders={folders} defaultFolderId={defaultFolderId} />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="ui-action-primary flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
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
  folders,
  isPending,
  onSave,
  onCancel,
}: {
  item: MediaItem;
  folders: MediaFolder[];
  isPending: boolean;
  onSave: (formData: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(new FormData(event.currentTarget));
      }}
      className="rounded-xl border border-brandnavy bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit media item</p>
        <button type="button" onClick={onCancel} className="rounded p-1 text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <MediaFormFields
        folders={folders}
        defaultName={item.name}
        defaultType={item.type}
        defaultUrl={item.url}
        defaultFolderId={item.folderId ?? ""}
      />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="ui-action-primary flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Save
        </button>
      </div>
    </form>
  );
}

function MediaFormFields({
  folders,
  defaultName = "",
  defaultType = "video",
  defaultUrl = "",
  defaultFolderId = "",
}: {
  folders: MediaFolder[];
  defaultName?: string;
  defaultType?: string;
  defaultUrl?: string;
  defaultFolderId?: string;
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
        <label className="block text-xs font-semibold text-slate-600">Folder</label>
        <select
          name="folderId"
          defaultValue={defaultFolderId}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
        >
          <option value="">Unfiled</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
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
