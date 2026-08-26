"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, LoaderCircle, Palette, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateBrandAppearanceAction } from "./actions";
import { normalizeBrandColor } from "@/lib/brands/colors";

type AssetKind = "logo" | "mark" | "logo-dark" | "mark-dark";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const THEME_PRESETS = [
  { name: "Professional navy", color: "#17324d", mode: "light" },
  { name: "Modern slate", color: "#334155", mode: "light" },
  { name: "Grok", color: "#111111", mode: "dark" },
] as const;

type Theme = {
  primaryColor: string;
  mode: string;
  logoUrl: string | null;
  logoMarkUrl: string | null;
  logoDarkUrl: string | null;
  logoMarkDarkUrl: string | null;
  sidebarLogoType: string;
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

    const coloredCounts = new Map<string, number>();
    const fallbackCounts = new Map<string, number>();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 128) continue;
      const sourceRed = pixels[index];
      const sourceGreen = pixels[index + 1];
      const sourceBlue = pixels[index + 2];
      const red = Math.round(sourceRed / 32) * 32;
      const green = Math.round(sourceGreen / 32) * 32;
      const blue = Math.round(sourceBlue / 32) * 32;
      const key = `${Math.min(255, red)},${Math.min(255, green)},${Math.min(255, blue)}`;
      const maximum = Math.max(sourceRed, sourceGreen, sourceBlue);
      const minimum = Math.min(sourceRed, sourceGreen, sourceBlue);
      const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
      const lightness = (maximum + minimum) / 2;

      // Avoid sampling transparent/white artwork backgrounds as the brand color.
      if (lightness < 242) {
        fallbackCounts.set(key, (fallbackCounts.get(key) ?? 0) + 1);
        if (saturation >= 0.18) {
          coloredCounts.set(key, (coloredCounts.get(key) ?? 0) + 1);
        }
      }
    }
    const dominant = [...(coloredCounts.size ? coloredCounts : fallbackCounts).entries()].sort(
      ([, left], [, right]) => right - left,
    )[0]?.[0];
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
  const isMark = kind.includes("mark");
  const isDark = kind.endsWith("-dark");
  const assetName = isMark ? "Logo mark" : "Logo";
  const label = `${assetName} · ${isDark ? "Dark mode" : "Light mode"}`;
  const recommendation = isMark ? "Recommended: 512 × 512 px." : "Recommended: 1200 × 400 px.";

  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-1 text-xs text-slate-500">
        {isDark
          ? "Shown when the portal is in Dark mode. Choose the version with enough contrast against the dark interface."
          : "Shown when the portal is in Light mode. Choose the version with enough contrast against the light interface."}
      </p>
      <p className="mt-1 text-xs text-slate-500">{recommendation} PNG, JPEG, WebP, or SVG; 2 MB maximum.</p>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files.item(0);
          if (file) onUpload(kind, file);
        }}
        className="mt-3 flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-3"
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
  const [logoDarkUrl, setLogoDarkUrl] = useState(theme.logoDarkUrl);
  const [logoMarkDarkUrl, setLogoMarkDarkUrl] = useState(theme.logoMarkDarkUrl);
  const [sidebarLogoType, setSidebarLogoType] = useState(theme.sidebarLogoType === "logo" ? "logo" : "mark");
  const [uploading, setUploading] = useState<AssetKind | null>(null);
  const [generatingColor, setGeneratingColor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedAppearance = useRef(`${normalizeBrandColor(theme.primaryColor) ?? "#17324d"}:${mode}:${sidebarLogoType}`);

  const colorValue = normalizeBrandColor(primaryColor) ?? "#17324d";

  useEffect(() => {
    const normalized = normalizeBrandColor(primaryColor);
    if (!normalized) return;
    const appearance = `${normalized}:${mode}:${sidebarLogoType}`;
    if (appearance === savedAppearance.current) return;

    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.set("primaryColor", normalized);
          formData.set("mode", mode);
          formData.set("sidebarLogoType", sidebarLogoType);
          await updateBrandAppearanceAction(formData);
          savedAppearance.current = appearance;
          setPrimaryColor(normalized);
          setSaved(true);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save brand appearance.");
        }
      });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [mode, primaryColor, router, sidebarLogoType, startTransition]);

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
      else if (kind === "mark") setLogoMarkUrl(result.url);
      else if (kind === "logo-dark") setLogoDarkUrl(result.url);
      else setLogoMarkDarkUrl(result.url);
      if (result.suggestedColor) setPrimaryColor(result.suggestedColor);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this image.");
    } finally {
      setUploading(null);
    }
  }

  async function generateColorFromLogo() {
    setError(null);
    setSaved(false);
    setGeneratingColor(true);
    try {
      const response = await fetch("/api/brand-assets?kind=logo", { cache: "no-store" });
      if (!response.ok) throw new Error("Upload a horizontal logo before generating its color.");
      const blob = await response.blob();
      const suggestedColor = await sampleLogoColor(
        new File([blob], "brand-logo", { type: blob.type || "image/png" }),
      );
      if (!suggestedColor) throw new Error("This logo does not contain enough visible color to generate a theme.");
      setPrimaryColor(suggestedColor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate a color from this logo.");
    } finally {
      setGeneratingColor(false);
    }
  }

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Brand appearance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Set the visual identity used throughout this brand&apos;s portal.
        </p>
      </div>

      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        “Light mode” and “Dark mode” refer to the surrounding portal interface. Upload whichever version of each logo has the best contrast in that mode—whether the artwork is transparent or includes its own background.
      </p>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <AssetDropzone kind="mark" url={logoMarkUrl} uploading={uploading === "mark"} onUpload={uploadAsset} />
        <AssetDropzone kind="logo" url={logoUrl} uploading={uploading === "logo"} onUpload={uploadAsset} />
        <AssetDropzone kind="mark-dark" url={logoMarkDarkUrl} uploading={uploading === "mark-dark"} onUpload={uploadAsset} />
        <AssetDropzone kind="logo-dark" url={logoDarkUrl} uploading={uploading === "logo-dark"} onUpload={uploadAsset} />
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
              onChange={(event) => {
                setSaved(false);
                setPrimaryColor(event.target.value);
              }}
              className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-white p-1"
              aria-label="Choose brand color"
            />
            <input
              value={primaryColor}
              onChange={(event) => {
                setSaved(false);
                setPrimaryColor(event.target.value);
              }}
              onBlur={() => {
                const normalized = normalizeBrandColor(primaryColor);
                if (normalized) {
                  setError(null);
                  setPrimaryColor(normalized);
                } else {
                  setError("Enter a HEX color or RGB value, such as #17324d or rgb(23, 50, 77).");
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
              placeholder="#17324d or rgb(23, 50, 77)"
              aria-label="Brand color as HEX or RGB"
            />
          </div>
          <button
            type="button"
            disabled={!logoUrl || generatingColor || uploading !== null}
            onClick={generateColorFromLogo}
            className="mt-2 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generatingColor ? <LoaderCircle size={15} className="animate-spin" /> : <Palette size={15} />}
            {generatingColor ? "Generating…" : "Generate from logo"}
          </button>
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
                className={`theme-mode-option cursor-pointer rounded-md border px-3 py-2 text-sm font-medium ${
                  mode === value
                    ? "theme-mode-option-selected border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="theme-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => {
                    setSaved(false);
                    setMode(value);
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-800">Professional starting themes</h3>
        <p className="mt-1 text-xs text-slate-500">Choose a clean starting point, then fine-tune the brand color above.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {THEME_PRESETS.map((preset) => {
            const selected = colorValue.toLowerCase() === preset.color && mode === preset.mode;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setPrimaryColor(preset.color);
                  setMode(preset.mode);
                  setSaved(false);
                }}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm font-medium transition-colors ${
                  selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="h-7 w-7 shrink-0 rounded-md" style={{ backgroundColor: preset.color }} />
                <span className="text-slate-700">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <fieldset className="border-t border-slate-100 pt-5">
        <legend className="text-sm font-semibold text-slate-800">Sidebar branding</legend>
        <p className="mt-1 text-xs text-slate-500">
          The sidebar is always a dark branded surface, so it uses the Dark mode version. Light mode assets remain available for future light-surface placements.
        </p>
        <div className="mt-3 flex items-center gap-3 text-sm font-medium text-slate-700">
          <span className={sidebarLogoType === "mark" ? "text-slate-900" : "text-slate-500"}>Logo mark</span>
          <button
            type="button"
            role="switch"
            aria-checked={sidebarLogoType === "logo"}
            aria-label="Use the full logo in the sidebar"
            onClick={() => {
              setSaved(false);
              setSidebarLogoType((current) => (current === "mark" ? "logo" : "mark"));
            }}
            className="sidebar-branding-toggle relative h-7 w-12 rounded-full transition-colors"
            style={{ backgroundColor: sidebarLogoType === "logo" ? "var(--brand-primary)" : "#64748b" }}
          >
            <span
              className={`absolute left-1 top-1 h-5 w-5 rounded-full border border-slate-300 bg-white shadow-sm transition-transform ${
                sidebarLogoType === "logo" ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className={sidebarLogoType === "logo" ? "text-slate-900" : "text-slate-500"}>Full logo</span>
        </div>
      </fieldset>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {pending ? <p className="text-sm text-slate-500">Saving appearance…</p> : null}
      {!pending && saved ? <p className="text-sm text-emerald-700">Appearance saved.</p> : null}
    </section>
  );
}
