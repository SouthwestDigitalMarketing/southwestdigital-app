"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateBrandAppearanceAction } from "./actions";
import {
  contrastRatio,
  normalizeBrandColor,
  readableForegroundColor,
  textContrastRating,
  type TextContrastRating,
} from "@/lib/brands/colors";
import {
  BRAND_COLORS_CHOICE,
  THEME_PRESETS,
  normalizeThemeChoice,
  type ThemeChoice,
} from "@/lib/brands/themePresets";

type AssetKind = "logo" | "mark" | "logo-dark" | "mark-dark";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

type Theme = {
  lightColor: string;
  darkColor: string | null;
  accentColor: string;
  accentForegroundColor: string;
  mode: string;
  logoUrl: string | null;
  logoMarkUrl: string | null;
  logoDarkUrl: string | null;
  logoMarkDarkUrl: string | null;
  sidebarLogoType: string;
  themePreset: string;
};

const CONTRAST_EXPLANATIONS: Record<TextContrastRating, string> = {
  AAA: "Meets WCAG enhanced guidance for ordinary text with a contrast ratio of at least 7:1.",
  AA: "Meets WCAG guidance for ordinary text with a contrast ratio of at least 4.5:1.",
  Fail: "Does not meet WCAG guidance for ordinary text. A contrast ratio of at least 4.5:1 is required.",
};

function BrandColorSwatch({
  label,
  background,
  foreground,
}: {
  label: string;
  background: string;
  foreground?: string;
}) {
  const textColor = foreground ?? readableForegroundColor(background);
  const ratio = contrastRatio(textColor, background) ?? 1;
  const rating = textContrastRating(textColor, background);
  const textDescription = textColor.toLowerCase() === "#ffffff" ? "White text" : "Dark text";
  const tooltipId = `contrast-${label.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="group relative">
          <button
            type="button"
            aria-describedby={tooltipId}
            aria-label={`${rating === "Fail" ? "Fails" : rating} contrast guidance for ${label}`}
            data-rating={rating}
            className="ui-contrast-badge cursor-help rounded-full border px-2 py-0.5 text-xs font-bold"
          >
            {rating === "Fail" ? "Fails" : rating}
          </button>
          <div
            id={tooltipId}
            role="tooltip"
            className="ui-tooltip pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-64 rounded-lg px-3 py-2 text-left text-xs font-normal leading-relaxed opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          >
            {CONTRAST_EXPLANATIONS[rating]} This checks {textDescription.toLowerCase()} against the {label.toLowerCase()} color. Contrast is {ratio.toFixed(2)}:1.
          </div>
        </div>
      </div>
      <div
        className="flex h-16 w-full flex-col items-center justify-center rounded-lg border border-black/10"
        style={{ backgroundColor: background, color: textColor }}
      >
        <span className="text-base font-semibold">Sample text</span>
        <span className="text-xs opacity-80">{textDescription} · {ratio.toFixed(2)}:1</span>
      </div>
    </>
  );
}

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
  brandLight,
  brandDark,
}: {
  kind: AssetKind;
  url: string | null;
  uploading: boolean;
  onUpload: (kind: AssetKind, file: File) => void;
  onRemove: (kind: AssetKind) => void;
  brandLight: string;
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
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files.item(0);
          if (file) onUpload(kind, file);
        }}
        onClick={() => inputRef.current?.click()}
        className="h-40 min-w-0 cursor-pointer p-6 transition-opacity hover:opacity-80"
        style={{ backgroundColor: previewBg }}
      >
        {url ? (
          <img
            src={url}
            alt={label}
            className={isMark ? "brand-asset-mark" : "brand-asset-fit"}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {isMark ? (
              <ExampleMarkPair onDark={isDark} brandColor={brandLight} />
            ) : (
              <ExampleLogoPair onDark={isDark} brandColor={brandLight} />
            )}
          </div>
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
  const [lightColor, setLightColor] = useState(theme.lightColor);
  const [mode, setMode] = useState(theme.mode === "dark" ? "dark" : "light");
  const [logoUrl, setLogoUrl] = useState(theme.logoUrl);
  const [logoMarkUrl, setLogoMarkUrl] = useState(theme.logoMarkUrl);
  const [logoDarkUrl, setLogoDarkUrl] = useState(theme.logoDarkUrl);
  const [logoMarkDarkUrl, setLogoMarkDarkUrl] = useState(theme.logoMarkDarkUrl);
  const [sidebarLogoType, setSidebarLogoType] = useState(theme.sidebarLogoType === "logo" ? "logo" : "mark");
  const [darkColor, setDarkColor] = useState(theme.darkColor ?? "");
  const [accentColor, setAccentColor] = useState(theme.accentColor);
  const [accentForegroundColor, setAccentForegroundColor] = useState(
    theme.accentForegroundColor === "#111827" ? "#111827" : "#ffffff",
  );
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(normalizeThemeChoice(theme.themePreset));
  const [uploading, setUploading] = useState<AssetKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedAppearance = useRef(`${normalizeBrandColor(theme.lightColor) ?? "#17324d"}:${theme.darkColor ?? ""}:${theme.accentColor}:${accentForegroundColor}:${mode}:${sidebarLogoType}:${normalizeThemeChoice(theme.themePreset)}`);

  const colorValue = normalizeBrandColor(lightColor) ?? "#17324d";

  function updateBrandColor(
    setter: (value: string) => void,
    value: string,
  ) {
    setSaved(false);
    setter(value);
  }

  useEffect(() => {
    const normalized = normalizeBrandColor(lightColor);
    if (!normalized) return;
    const normalizedDark = darkColor ? (normalizeBrandColor(darkColor) ?? "") : "";
    const normalizedAccent = normalizeBrandColor(accentColor) ?? "";
    const appearance = `${normalized}:${normalizedDark}:${normalizedAccent}:${accentForegroundColor}:${mode}:${sidebarLogoType}:${themeChoice}`;
    if (appearance === savedAppearance.current) return;

    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.set("lightColor", normalized);
          formData.set("darkColor", normalizedDark);
          formData.set("accentColor", normalizedAccent);
          formData.set("accentForegroundColor", accentForegroundColor);
          formData.set("mode", mode);
          formData.set("sidebarLogoType", sidebarLogoType);
          formData.set("themePreset", themeChoice);
          await updateBrandAppearanceAction(formData);
          savedAppearance.current = appearance;
          setLightColor(normalized);
          setSaved(true);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save brand appearance.");
        }
      });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [accentColor, accentForegroundColor, darkColor, lightColor, mode, router, sidebarLogoType, startTransition, themeChoice]);

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
      if (result.suggestedColor) updateBrandColor(setLightColor, result.suggestedColor);
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
        <div className="mt-5 grid min-w-0 grid-cols-2 gap-4 xl:grid-cols-4">
          <AssetDropzone kind="mark" url={logoMarkUrl} uploading={uploading === "mark"} onUpload={uploadAsset} onRemove={removeAsset} brandLight={colorValue} brandDark={normalizeBrandColor(darkColor) ?? colorValue} />
          <AssetDropzone kind="logo" url={logoUrl} uploading={uploading === "logo"} onUpload={uploadAsset} onRemove={removeAsset} brandLight={colorValue} brandDark={normalizeBrandColor(darkColor) ?? colorValue} />
          <AssetDropzone kind="mark-dark" url={logoMarkDarkUrl} uploading={uploading === "mark-dark"} onUpload={uploadAsset} onRemove={removeAsset} brandLight={colorValue} brandDark={normalizeBrandColor(darkColor) ?? colorValue} />
          <AssetDropzone kind="logo-dark" url={logoDarkUrl} uploading={uploading === "logo-dark"} onUpload={uploadAsset} onRemove={removeAsset} brandLight={colorValue} brandDark={normalizeBrandColor(darkColor) ?? colorValue} />
        </div>
      </section>

      {/* Brand Colors */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your Brand Colors</h2>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {/* Light */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <BrandColorSwatch label="Light" background={colorValue} />
            <div className="mt-2 flex gap-2">
              <input
                id="brand-light-color"
                type="color"
                value={colorValue}
                onChange={(e) => updateBrandColor(setLightColor, e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-1"
                aria-label="Choose light brand color"
              />
              <input
                value={lightColor}
                onChange={(e) => updateBrandColor(setLightColor, e.target.value)}
                onBlur={() => {
                  const n = normalizeBrandColor(lightColor);
                  if (n) { setError(null); setLightColor(n); }
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
            <BrandColorSwatch label="Dark" background={normalizeBrandColor(darkColor) ?? "#0f1d2e"} foreground="#ffffff" />
            <div className="mt-2 flex gap-2">
              <input
                id="brand-dark-color"
                type="color"
                value={normalizeBrandColor(darkColor) ?? "#0f1d2e"}
                onChange={(e) => updateBrandColor(setDarkColor, e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-1"
                aria-label="Choose dark brand color"
              />
              <input
                value={darkColor}
                onChange={(e) => updateBrandColor(setDarkColor, e.target.value)}
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

          {/* Accent */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <BrandColorSwatch
              label="Accent"
              background={normalizeBrandColor(accentColor) ?? "#d79b3b"}
              foreground={accentForegroundColor}
            />
            <div className="mt-2 flex gap-2">
              <input
                id="brand-accent-color"
                type="color"
                value={normalizeBrandColor(accentColor) ?? "#d79b3b"}
                onChange={(e) => updateBrandColor(setAccentColor, e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border border-slate-300 bg-white p-1"
                aria-label="Choose accent brand color"
              />
              <input
                value={accentColor}
                onChange={(e) => updateBrandColor(setAccentColor, e.target.value)}
                onBlur={() => {
                  const n = normalizeBrandColor(accentColor);
                  if (n) { setError(null); setAccentColor(n); }
                  else setError("Enter a HEX color or RGB value for Accent.");
                }}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 font-mono text-base text-slate-800 focus:border-slate-500 focus:outline-none"
                placeholder="#d79b3b"
                aria-label="Accent brand color as HEX"
              />
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accent button text</p>
              <div className="mt-3 flex items-center gap-3 text-base font-medium text-slate-700">
                <span className={accentForegroundColor === "#ffffff" ? "text-slate-900" : "text-slate-500"}>White</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={accentForegroundColor === "#111827"}
                  aria-label="Use black text on accent buttons"
                  onClick={() => {
                    setSaved(false);
                    setAccentForegroundColor((current) => current === "#111827" ? "#ffffff" : "#111827");
                  }}
                  className="ui-toggle-switch"
                >
                  <span className="ui-toggle-switch-thumb" />
                </button>
                <span className={accentForegroundColor === "#111827" ? "text-slate-900" : "text-slate-500"}>Black</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Controls text and icons placed on accent-colored buttons in the proposal preview.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Theme */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Theme</h2>

        <div className="mt-4 grid gap-4 grid-cols-2">
          {/* Starting themes */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setThemeChoice(BRAND_COLORS_CHOICE);
                  setSaved(false);
                }}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left text-base font-medium transition-colors ${
                  themeChoice === BRAND_COLORS_CHOICE
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 overflow-hidden rounded-md">
                  <span className="flex-1" style={{ backgroundColor: colorValue }} />
                  <span className="flex-1" style={{ backgroundColor: normalizeBrandColor(darkColor) ?? colorValue }} />
                  <span className="flex-1" style={{ backgroundColor: normalizeBrandColor(accentColor) ?? "#d79b3b" }} />
                </span>
                <span className="text-slate-700">Your Brand Colors</span>
              </button>
              {THEME_PRESETS.map((preset) => {
                const selected = themeChoice === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setThemeChoice(preset.id);
                      setMode(preset.mode);
                      setSaved(false);
                    }}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left text-base font-medium transition-colors ${
                      selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 overflow-hidden rounded-md">
                      <span className="flex-1" style={{ backgroundColor: preset.lightColor }} />
                      <span className="flex-1" style={{ backgroundColor: preset.darkColor }} />
                      <span className="flex-1" style={{ backgroundColor: preset.accentColor }} />
                    </span>
                    <span className="text-slate-700">{preset.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar branding + Portal theme */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sidebar branding</p>
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
                  className="ui-toggle-switch"
                >
                  <span className="ui-toggle-switch-thumb" />
                </button>
                <span className={sidebarLogoType === "logo" ? "text-slate-900" : "text-slate-500"}>Full logo</span>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portal theme</p>
              <div className="mt-3 flex items-center gap-3 text-base font-medium text-slate-700">
                <span className={mode === "light" ? "text-slate-900" : "text-slate-500"}>Light</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={mode === "dark"}
                  aria-label="Use the dark portal theme"
                  onClick={() => {
                    setSaved(false);
                    setMode((current) => (current === "dark" ? "light" : "dark"));
                  }}
                  className="ui-toggle-switch"
                >
                  <span className="ui-toggle-switch-thumb" />
                </button>
                <span className={mode === "dark" ? "text-slate-900" : "text-slate-500"}>Dark</span>
              </div>
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
