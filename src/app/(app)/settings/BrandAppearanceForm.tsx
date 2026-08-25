"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, LoaderCircle, Palette, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateBrandAppearanceAction } from "./actions";
import { normalizeBrandColor } from "@/lib/brands/colors";

type AssetKind = "logo" | "mark";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

type Theme = {
  primaryColor: string;
  mode: string;
  logoUrl: string | null;
  logoMarkUrl: string | null;
};

async function sampleLogoColor(file: File): Promise<string | null> {
  if (file.type === "image/svg+xml") return null;

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = imageUrl;
    });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 64 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const counts = new Map<string, number>();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 128) continue;
      const red = Math.round(pixels[index] / 32) * 32;
      const green = Math.round(pixels[index + 1] / 32) * 32;
      const blue = Math.round(pixels[index + 2] / 32) * 32;
      const key = `${Math.min(255, red)},${Math.min(255, green)},${Math.min(255, blue)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const dominant = [...counts.entries()].sort(([, left], [, right]) => right - left)[0]?.[0];
    if (!dominant) return null;
    return `#${dominant.split(",").map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function AssetDropzone({
  kind,
  url,
  uploading,
  onUpload,
}: {
  kind: AssetKind;
  url: string | null;
  uploading: boolean;
  onUpload: (kind: AssetKind, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isMark = kind === "mark";
  const label = isMark ? "Logo mark" : "Logo";
  const recommendation = isMark ? "Recommended: 512 × 512 px." : "Recommended: 1200 × 400 px.";

  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-1 text-xs text-slate-500">
        {isMark ? "Square mark; ideal for the sidebar." : "Horizontal logo; used where the full brand name is helpful."}
      </p>
      <p className="mt-1 text-xs text-slate-500">{recommendation} PNG, JPEG, WebP, or SVG; 2 MB maximum.</p>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files.item(0);
          if (file) onUpload(kind, file);
        }}
        className={`mt-3 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-3 ${
          isMark ? "aspect-square" : "aspect-[3/1]"
        }`}
      >
        {url ? (
          <img src={url} alt={`${label} preview`} className="h-full max-h-28 max-w-full object-contain" />
        ) : (
          <ImagePlus className="text-slate-400" size={24} />
        )}
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(kind, file);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
        {uploading ? "Uploading…" : url ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      </button>
    </div>
  );
}

export function BrandAppearanceForm({ theme }: { theme: Theme }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [primaryColor, setPrimaryColor] = useState(theme.primaryColor);
  const [mode, setMode] = useState(["system", "light", "dark"].includes(theme.mode) ? theme.mode : "system");
  const [logoUrl, setLogoUrl] = useState(theme.logoUrl);
  const [logoMarkUrl, setLogoMarkUrl] = useState(theme.logoMarkUrl);
  const [uploading, setUploading] = useState<AssetKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const colorValue = normalizeBrandColor(primaryColor) ?? "#17324d";

  async function uploadAsset(kind: AssetKind, file: File) {
    setError(null);
    setSaved(false);
    if (file.size > MAX_FILE_SIZE) {
      setError("Images must be 2 MB or smaller.");
      return;
    }

    setUploading(kind);
    try {
      const suggestedColor = await sampleLogoColor(file);
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("file", file);
      if (suggestedColor) formData.set("suggestedColor", suggestedColor);
      const response = await fetch("/api/brand-assets", { method: "POST", body: formData });
      const result = (await response.json()) as { url?: string; error?: string; suggestedColor?: string | null };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Could not upload this image.");
      if (kind === "logo") setLogoUrl(result.url);
      else setLogoMarkUrl(result.url);
      if (result.suggestedColor) setPrimaryColor(result.suggestedColor);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this image.");
    } finally {
      setUploading(null);
    }
  }

  return (
    <form
      className="space-y-6 rounded-xl border border-slate-200 bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        const normalized = normalizeBrandColor(primaryColor);
        if (!normalized) {
          setError("Enter a HEX color or RGB value, such as #17324d or rgb(23, 50, 77).");
          return;
        }
        startTransition(async () => {
          try {
            const formData = new FormData();
            formData.set("primaryColor", normalized);
            formData.set("mode", mode);
            await updateBrandAppearanceAction(formData);
            setPrimaryColor(normalized);
            setSaved(true);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save brand appearance.");
          }
        });
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-slate-800">Brand appearance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Set the visual identity used throughout this brand&apos;s portal.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <AssetDropzone kind="mark" url={logoMarkUrl} uploading={uploading === "mark"} onUpload={uploadAsset} />
        <AssetDropzone kind="logo" url={logoUrl} uploading={uploading === "logo"} onUpload={uploadAsset} />
      </div>

      <div className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-slate-800" htmlFor="brand-primary-color">
            Brand color
          </label>
          <p className="mt-1 text-xs text-slate-500">Upload a logo first to automatically pick its dominant color.</p>
          <div className="mt-3 flex gap-2">
            <input
              id="brand-primary-color"
              type="color"
              value={colorValue}
              onChange={(event) => setPrimaryColor(event.target.value)}
              className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-white p-1"
              aria-label="Choose brand color"
            />
            <input
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              onBlur={() => {
                const normalized = normalizeBrandColor(primaryColor);
                if (normalized) setPrimaryColor(normalized);
              }}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
              placeholder="#17324d or rgb(23, 50, 77)"
              aria-label="Brand color as HEX or RGB"
            />
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">Portal theme</legend>
          <p className="mt-1 text-xs text-slate-500">System follows each user&apos;s device preference.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ].map(([value, label]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium ${
                  mode === value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="theme-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Brand appearance saved.</p> : null}

      <button
        type="submit"
        disabled={pending || uploading !== null}
        className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        <Palette size={16} />
        {pending ? "Saving…" : "Save appearance"}
      </button>
    </form>
  );
}
