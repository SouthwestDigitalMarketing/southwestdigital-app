"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, Upload } from "lucide-react";
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
  darkColor: string | null;
  accentColor: string;
  accentDarkColor: string | null;
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

// Example brand used as placeholder illustration in each upload card
function ExampleLogoPair({ onDark, brandColor }: { onDark: boolean; brandColor: string }) {
  const ink = onDark ? "#ffffff" : brandColor;
  const labelColor = onDark ? "rgba(255,255,255,0.45)" : "#94a3b8";
  return (
    <div className="flex w-full flex-col gap-4 px-2">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold"
            style={{ backgroundColor: ink, color: onDark ? brandColor : "#ffffff" }}
          >
            E
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ color: ink }}>
            Example Inc.
          </span>
        </div>
        <span className="text-base" style={{ color: labelColor }}>Filled mark</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold"
            style={{ border: `2px solid ${ink}`, color: ink }}
          >
            E
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ color: ink }}>
            Example Inc.
          </span>
        </div>
        <span className="text-base" style={{ color: labelColor }}>Outlined mark</span>
      </div>
    </div>
  );
}

function ExampleMarkPair({ onDark, brandColor }: { onDark: boolean; brandColor: string }) {
  const ink = onDark ? "#ffffff" : brandColor;
  return (
    <div className="flex items-center gap-5">
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
          style={{ backgroundColor: ink, color: onDark ? brandColor : "#ffffff" }}
        >
          E
        </div>
        <span className="text-base" style={{ color: onDark ? "rgba(255,255,255,0.45)" : "#94a3b8" }}>Filled</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
          style={{ border: `2px solid ${ink}`, color: ink }}
        >
          E
        </div>
        <span className="text-base" style={{ color: onDark ? "rgba(255,255,255,0.45)" : "#94a3b8" }}>Outlined</span>
      </div>
    </div>
  );
}

function AssetDropzone({
  kind,
  url,
  uploading,
  onUpload,
  onRemove,
  brandPrimary,
  brandDark,
}: {
  kind: AssetKind;
  url: string | null;
  uploading: boolean;
  onUpload: (kind: AssetKind, file: File) => void;
  onRemove: (kind: AssetKind) => void;
  brandPrimary: string;
  brandDark: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isMark = kind.includes("mark");
  const isDark = kind.endsWith("-dark");
  const label = `${isMark ? "Logo mark" : "Logo"} for ${isDark ? "dark" : "light"} backgrounds`;
  const dims = `Recommended: ${isMark ? "512 × 512 px" : "1200 × 400 px"} · 2 MB max`;
  const types = "PNG, JPEG, WebP, or SVG";
  const previewBg = isDark ? brandDark : "#ffffff";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files.item(0);
          if (file) onUpload(kind, file);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex h-40 cursor-pointer items-center justify-center p-6 transition-opacity hover:opacity-80"
        style={{ backgroundColor: previewBg }}
      >
        {url ? (
          <img
            src={url}
            alt={label}
            className={`max-w-full object-contain ${isMark ? "h-16 w-16" : "max-h-12"}`}
          />
        ) : isMark ? (
          <ExampleMarkPair onDark={isDark} brandColor={brandPrimary} />
        ) : (
          <ExampleLogoPair onDark={isDark} brandColor={brandPrimary} />
        )}
      </div>
      <div className="border-t border-slate-100 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-base text-slate-400">{dims}</p>
        <p className="text-base text-slate-400">{types}</p>
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
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? "Uploading…" : url ? "Replace" : "Upload"}
          </button>
          {url ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(kind); }}
              className="inline-flex cursor-pointer items-center rounded-md border border-rose-200 bg-white px-3 py-2 text-base font-medium text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BrandAppearanceForm({ theme }: { theme: Theme }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [primaryColor, setPrimaryColor] = useState(theme.primaryColor);
  const [mode, setMode] = useState(theme.mode === "dark" ? "dark" : "light");
  const [logoUrl, setLogoUrl] = useState(theme.logoUrl);
  const [logoMarkUrl, setLogoMarkUrl] = useState(theme.logoMarkUrl);
  const [logoDarkUrl, setLogoDarkUrl] = useState(theme.logoDarkUrl);
  const [logoMarkDarkUrl, setLogoMarkDarkUrl] = useState(theme.logoMarkDarkUrl);
  const [sidebarLogoType, setSidebarLogoType] = useState(theme.sidebarLogoType === "logo" ? "logo" : "mark");
  const [darkColor, setDarkColor] = useState(theme.darkColor ?? "");
  const [accentColor, setAccentColor] = useState(theme.accentColor);
  const [accentDarkColor, setAccentDarkColor] = useState(theme.accentDarkColor ?? "");
  const [uploading, setUploading] = useState<AssetKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedAppearance = useRef(`${normalizeBrandColor(theme.primaryColor) ?? "#17324d"}:${theme.darkColor ?? ""}:${theme.accentColor}:${theme.accentDarkColor ?? ""}:${mode}:${sidebarLogoType}`);

  const colorValue = normalizeBrandColor(primaryColor) ?? "#17324d";

  useEffect(() => {
    const normalized = normalizeBrandColor(primaryColor);
    if (!normalized) return;
    const normalizedDark = darkColor ? (normalizeBrandColor(darkColor) ?? "") : "";
    const normalizedAccent = normalizeBrandColor(accentColor) ?? "";
    const normalizedAccentDark = accentDarkColor ? (normalizeBrandColor(accentDarkColor) ?? "") : "";
    const appearance = `${normalized}:${normalizedDark}:${normalizedAccent}:${normalizedAccentDark}:${mode}:${sidebarLogoType}`;
    if (appearance === savedAppearance.current) return;

    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.set("primaryColor", normalized);
          formData.set("darkColor", normalizedDark);
          formData.set("accentColor", normalizedAccent);
          formData.set("accentDarkColor", normalizedAccentDark);
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
  }, [accentColor, accentDarkColor, darkColor, mode, primaryColor, router, sidebarLogoType, startTransition]);

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

  async function removeAsset(kind: AssetKind) {
    setError(null);
    try {
      const response = await fetch(`/api/brand-assets?kind=${kind}`, { method: "DELETE" });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not remove this image.");
      if (kind === "logo") setLogoUrl(null);
      else if (kind === "mark") setLogoMarkUrl(null);
      else if (kind === "logo-dark") setLogoDarkUrl(null);
      else setLogoMarkDarkUrl(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this image.");
    }
  }

  return (
    <div className="grid gap-4">
      {/* Logo */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logo</h2>
        <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <AssetDropzone kind="mark" url={logoMarkUrl} uploading={uploading === "mark"} onUpload={uploadAsset} onRemove={removeAsset} brandPrimary={colorValue} brandDark={normalizeBrandColor(darkColor) ?? colorValue} />
          <AssetDropzone kind="logo" url={logoUrl} uploading={uploading === "logo"} onUpload={uploadAsset} onRemove={removeAsset} brandPrimary={colorValue} brandDark={normalizeBrandColor(darkColor) ?? colorValue} />
          <AssetDropzone kind="mark-dark" url={logoMarkDarkUrl} uploading={uploading === "mark-dark"} onUpload={uploadAsset} onRemove={removeAsset} brandPrimary={colorValue} brandDark={normalizeBrandColor(darkColor) ?? colorValue} />
          <AssetDropzone kind="logo-dark" url={logoDarkUrl} uploading={uploading === "logo-dark"} onUpload={uploadAsset} onRemove={removeAsset} brandPrimary={colorValue} brandDark={normalizeBrandColor(darkColor) ?? colorValue} />
        </div>
      </section>

      {/* Brand Colors */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brand Colors</h2>
        <div className="mt-4 grid grid-cols-4 gap-4">
          {/* Light */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-16 w-full rounded-lg" style={{ backgroundColor: colorValue }} />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Light</p>
            <div className="mt-2 flex gap-2">
              <input
                id="brand-primary-color"
                type="color"
                value={colorValue}
                onChange={(e) => { setSaved(false); setPrimaryColor(e.target.value); }}
                className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-1"
                aria-label="Choose light brand color"
              />
              <input
                value={primaryColor}
                onChange={(e) => { setSaved(false); setPrimaryColor(e.target.value); }}
                onBlur={() => {
                  const n = normalizeBrandColor(primaryColor);
                  if (n) { setError(null); setPrimaryColor(n); }
                  else setError("Enter a HEX color or RGB value for Light.");
                }}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 font-mono text-base text-slate-800 focus:border-slate-500 focus:outline-none"
                placeholder="#17324d"
                aria-label="Light brand color as HEX"
              />
            </div>
          </div>

          {/* Dark */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-16 w-full rounded-lg" style={{ backgroundColor: normalizeBrandColor(darkColor) ?? "#0f1d2e" }} />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Dark</p>
            <div className="mt-2 flex gap-2">
              <input
                id="brand-dark-color"
                type="color"
                value={normalizeBrandColor(darkColor) ?? "#0f1d2e"}
                onChange={(e) => { setSaved(false); setDarkColor(e.target.value); }}
                className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-1"
                aria-label="Choose dark brand color"
              />
              <input
                value={darkColor}
                onChange={(e) => { setSaved(false); setDarkColor(e.target.value); }}
                onBlur={() => {
                  if (!darkColor) return;
                  const n = normalizeBrandColor(darkColor);
                  if (n) { setError(null); setDarkColor(n); }
                  else setError("Enter a HEX color or RGB value for Dark.");
                }}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 font-mono text-base text-slate-800 focus:border-slate-500 focus:outline-none"
                placeholder="#0f1d2e"
                aria-label="Dark brand color as HEX"
              />
            </div>
          </div>

          {/* Accent Light */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-16 w-full rounded-lg" style={{ backgroundColor: normalizeBrandColor(accentColor) ?? "#d79b3b" }} />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Accent Light</p>
            <div className="mt-2 flex gap-2">
              <input
                id="brand-accent-color"
                type="color"
                value={normalizeBrandColor(accentColor) ?? "#d79b3b"}
                onChange={(e) => { setSaved(false); setAccentColor(e.target.value); }}
                className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-1"
                aria-label="Choose accent light brand color"
              />
              <input
                value={accentColor}
                onChange={(e) => { setSaved(false); setAccentColor(e.target.value); }}
                onBlur={() => {
                  const n = normalizeBrandColor(accentColor);
                  if (n) { setError(null); setAccentColor(n); }
                  else setError("Enter a HEX color or RGB value for Accent Light.");
                }}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 font-mono text-base text-slate-800 focus:border-slate-500 focus:outline-none"
                placeholder="#d79b3b"
                aria-label="Accent light brand color as HEX"
              />
            </div>
          </div>

          {/* Accent Dark */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-16 w-full rounded-lg" style={{ backgroundColor: normalizeBrandColor(accentDarkColor) ?? "#8a5a12" }} />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Accent Dark</p>
            <div className="mt-2 flex gap-2">
              <input
                id="brand-accent-dark-color"
                type="color"
                value={normalizeBrandColor(accentDarkColor) ?? "#8a5a12"}
                onChange={(e) => { setSaved(false); setAccentDarkColor(e.target.value); }}
                className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-1"
                aria-label="Choose accent dark brand color"
              />
              <input
                value={accentDarkColor}
                onChange={(e) => { setSaved(false); setAccentDarkColor(e.target.value); }}
                onBlur={() => {
                  if (!accentDarkColor) return;
                  const n = normalizeBrandColor(accentDarkColor);
                  if (n) { setError(null); setAccentDarkColor(n); }
                  else setError("Enter a HEX color or RGB value for Accent Dark.");
                }}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 font-mono text-base text-slate-800 focus:border-slate-500 focus:outline-none"
                placeholder="#8a5a12"
                aria-label="Accent dark brand color as HEX"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Theme */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Theme</h2>

        <div className="mt-4 grid gap-4 grid-cols-3">
          {/* Starting themes */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Starting themes</p>
            <p className="mt-1 text-base text-slate-500">Choose a clean starting point, then fine-tune brand colors above.</p>
            <div className="mt-3 flex flex-col gap-2">
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
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left text-base font-medium transition-colors ${
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

          {/* Sidebar branding */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sidebar branding</p>
            <p className="mt-1 text-base text-slate-500">
              The sidebar is always a dark branded surface, so it uses the Dark mode version. Light mode assets remain available for future light-surface placements.
            </p>
            <div className="mt-3 flex items-center gap-3 text-base font-medium text-slate-700">
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
          </div>

          {/* Portal theme */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portal theme</p>
            <div className="mt-3 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
              {(["light", "dark"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setSaved(false); setMode(value); }}
                  className={`rounded-md px-5 py-1.5 text-base font-medium capitalize transition-colors ${
                    mode === value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {value.charAt(0).toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="mt-4 text-base text-red-600">{error}</p> : null}
        {pending ? <p className="mt-4 text-base text-slate-500">Saving…</p> : null}
        {!pending && saved ? <p className="mt-4 text-base text-emerald-700">Appearance saved.</p> : null}
      </section>
    </div>
  );
}
