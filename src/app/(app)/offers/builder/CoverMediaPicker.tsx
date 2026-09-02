"use client";

import { useMemo, useState } from "react";
import { Folder, Image as ImageIcon, Link2, Sparkles, Video, X } from "lucide-react";

export type CoverMediaItem = {
  id: string;
  name: string;
  type: string;
  url: string;
  folderId?: string | null;
};

export type CoverMediaFolder = {
  id: string;
  name: string;
};

type FilterId = "all" | "unfiled" | string;

export function CoverMediaPicker({
  open,
  onClose,
  items,
  folders,
  selectedMediaId,
  brandDefaultVideoUrl,
  brandDefaultImageUrl,
  customVideoUrl,
  customImageUrl,
  onSelectBrandDefault,
  onSelectLibraryItem,
  onSelectCustom,
  onCustomVideoUrlChange,
  onCustomImageUrlChange,
}: {
  open: boolean;
  onClose: () => void;
  items: CoverMediaItem[];
  folders: CoverMediaFolder[];
  selectedMediaId: string;
  brandDefaultVideoUrl: string | null;
  brandDefaultImageUrl: string | null;
  customVideoUrl: string;
  customImageUrl: string;
  onSelectBrandDefault: () => void;
  onSelectLibraryItem: (item: CoverMediaItem) => void;
  onSelectCustom: () => void;
  onCustomVideoUrlChange: (value: string) => void;
  onCustomImageUrlChange: (value: string) => void;
}) {
  const [filter, setFilter] = useState<FilterId>("all");

  const visibleItems = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unfiled") return items.filter((item) => !item.folderId);
    return items.filter((item) => item.folderId === filter);
  }, [filter, items]);

  if (!open) return null;

  const brandDefaultLabel = brandDefaultVideoUrl
    ? "Brand default video"
    : brandDefaultImageUrl
      ? "Brand default image"
      : "No brand default set";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-media-picker-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="cover-media-picker-title" className="text-base font-semibold text-slate-900">
              Choose cover media
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Select a video or image from your library.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="w-44 shrink-0 overflow-y-auto border-r border-slate-200 p-3">
            <FolderButton selected={filter === "all"} onClick={() => setFilter("all")} label="All media" />
            <FolderButton
              selected={filter === "unfiled"}
              onClick={() => setFilter("unfiled")}
              label="Unfiled"
            />
            {folders.map((folder) => (
              <FolderButton
                key={folder.id}
                selected={filter === folder.id}
                onClick={() => setFilter(folder.id)}
                label={folder.name}
              />
            ))}
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <MediaChoice
                selected={selectedMediaId === ""}
                onClick={() => {
                  onSelectBrandDefault();
                  onClose();
                }}
                icon={<Sparkles className="h-4 w-4" />}
                title="Use brand default"
                subtitle={brandDefaultLabel}
              />
              <MediaChoice
                selected={selectedMediaId === "custom"}
                onClick={onSelectCustom}
                icon={<Link2 className="h-4 w-4" />}
                title="Custom URL"
                subtitle="Paste a video or image link"
              />
            </div>

            {selectedMediaId === "custom" ? (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-xs font-semibold text-slate-600">
                  Video URL
                  <input
                    type="url"
                    value={customVideoUrl}
                    onChange={(event) => onCustomVideoUrlChange(event.target.value)}
                    placeholder="https://…"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Image URL
                  <input
                    type="url"
                    value={customImageUrl}
                    onChange={(event) => onCustomImageUrlChange(event.target.value)}
                    placeholder="https://…"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
                  />
                </label>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {visibleItems.length === 0 ? (
                <p className="col-span-full py-8 text-center text-sm text-slate-400">
                  No media in this folder. Add items on the Media page.
                </p>
              ) : (
                visibleItems.map((item) => (
                  <MediaChoice
                    key={item.id}
                    selected={selectedMediaId === item.id}
                    onClick={() => {
                      onSelectLibraryItem(item);
                      onClose();
                    }}
                    icon={
                      item.type === "video" ? (
                        <Video className="h-4 w-4" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )
                    }
                    title={item.name}
                    subtitle={item.type === "video" ? "Video" : "Image"}
                    previewUrl={item.type === "image" ? item.url : null}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FolderButton({
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

function MediaChoice({
  selected,
  onClick,
  icon,
  title,
  subtitle,
  previewUrl,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  previewUrl?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
        selected
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 bg-white hover:border-slate-400"
      }`}
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{subtitle}</span>
      </span>
    </button>
  );
}
