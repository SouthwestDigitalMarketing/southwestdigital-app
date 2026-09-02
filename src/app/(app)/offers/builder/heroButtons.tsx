"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Calculator,
  Calendar,
  Check,
  ChevronRight,
  CirclePlay,
  Download,
  Eye,
  Mail,
  Pause,
  Phone,
  Play,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Video,
} from "lucide-react";

export type HeroButtonIconPlacement = "none" | "start" | "end";

export type HeroButtonConfig = {
  label: string;
  icon: string;
  iconPlacement: HeroButtonIconPlacement;
  visible: boolean;
};

export const DEFAULT_HERO_MEDIA_BUTTON: HeroButtonConfig = {
  label: "Client Testimonial",
  icon: "play",
  iconPlacement: "end",
  visible: true,
};

export const DEFAULT_HERO_CONTINUE_BUTTON: HeroButtonConfig = {
  label: "Shop pricing",
  icon: "",
  iconPlacement: "none",
  visible: true,
};

export const HERO_BUTTON_ICONS = {
  play: { label: "Play", Icon: Play },
  "circle-play": { label: "Play circle", Icon: CirclePlay },
  video: { label: "Video", Icon: Video },
  "arrow-right": { label: "Arrow", Icon: ArrowRight },
  "chevron-right": { label: "Chevron", Icon: ChevronRight },
  sparkles: { label: "Sparkles", Icon: Sparkles },
  star: { label: "Star", Icon: Star },
  check: { label: "Check", Icon: Check },
  "shopping-bag": { label: "Shopping bag", Icon: ShoppingBag },
  tag: { label: "Tag", Icon: Tag },
  calculator: { label: "Calculator", Icon: Calculator },
  phone: { label: "Phone", Icon: Phone },
  mail: { label: "Mail", Icon: Mail },
  calendar: { label: "Calendar", Icon: Calendar },
  eye: { label: "Eye", Icon: Eye },
  download: { label: "Download", Icon: Download },
} as const;

export type HeroButtonIconKey = keyof typeof HERO_BUTTON_ICONS;

const PLACEMENTS: Array<{ id: HeroButtonIconPlacement; label: string }> = [
  { id: "none", label: "No icon" },
  { id: "start", label: "Icon first" },
  { id: "end", label: "Icon last" },
];

export function normalizeHeroButton(
  value: unknown,
  fallback: HeroButtonConfig,
): HeroButtonConfig {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  const iconPlacement =
    record.iconPlacement === "start" ||
    record.iconPlacement === "end" ||
    record.iconPlacement === "none"
      ? record.iconPlacement
      : fallback.iconPlacement;
  return {
    label: typeof record.label === "string" ? record.label : fallback.label,
    icon: typeof record.icon === "string" ? record.icon : fallback.icon,
    iconPlacement,
    visible: typeof record.visible === "boolean" ? record.visible : fallback.visible,
  };
}

function iconComponent(icon: string, playing: boolean): LucideIcon | null {
  if (playing && (icon === "play" || icon === "circle-play")) return Pause;
  const entry = HERO_BUTTON_ICONS[icon as HeroButtonIconKey];
  return entry?.Icon ?? null;
}

export function HeroCtaContent({
  config,
  fallbackLabel,
  playing = false,
}: {
  config: HeroButtonConfig;
  fallbackLabel: string;
  playing?: boolean;
}) {
  const label = config.label.trim() || fallbackLabel;
  const showIcon = config.iconPlacement !== "none" && Boolean(config.icon);
  const Icon = showIcon ? iconComponent(config.icon, playing) : null;
  const fillPlayPause = config.icon === "play" || config.icon === "circle-play";
  const iconEl = Icon ? (
    <Icon className={`h-5 w-5 ${fillPlayPause ? "fill-current" : ""}`} />
  ) : null;

  return (
    <>
      {config.iconPlacement === "start" ? iconEl : null}
      <span>{label}</span>
      {config.iconPlacement === "end" ? iconEl : null}
    </>
  );
}

export function HeroVideoButtonToggle({
  value,
  onChange,
}: {
  value: HeroButtonConfig;
  onChange: (next: HeroButtonConfig) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 proposal-builder-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Video button</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Show the play button on the proposal. This only appears when a video is selected.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className={`text-xs font-semibold ${value.visible ? "text-slate-400" : "text-slate-900"}`}>
            Hide
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={value.visible}
            aria-label="Show video button"
            onClick={() => onChange({ ...value, visible: !value.visible })}
            className="relative h-7 w-12 rounded-full transition-colors"
            style={{ backgroundColor: value.visible ? "var(--brand-primary)" : "#64748b" }}
          >
            <span
              className={`absolute left-1 top-1 h-5 w-5 rounded-full border border-slate-300 bg-white shadow-sm transition-transform ${
                value.visible ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className={`text-xs font-semibold ${value.visible ? "text-slate-900" : "text-slate-400"}`}>
            Show
          </span>
        </div>
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-700">
        Button text
        <span className="ml-2 font-normal text-slate-400">leave blank to use the default</span>
      </label>
      <input
        type="text"
        placeholder={DEFAULT_HERO_MEDIA_BUTTON.label}
        value={value.label}
        onChange={(event) => onChange({ ...value, label: event.target.value })}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
      />
    </div>
  );
}

export function HeroButtonEditor({
  title,
  description,
  value,
  fallback,
  defaultIcon,
  onChange,
}: {
  title: string;
  description: string;
  value: HeroButtonConfig;
  fallback: HeroButtonConfig;
  defaultIcon: HeroButtonIconKey;
  onChange: (next: HeroButtonConfig) => void;
}) {
  function setPlacement(iconPlacement: HeroButtonIconPlacement) {
    onChange({
      ...value,
      iconPlacement,
      icon:
        iconPlacement === "none"
          ? value.icon
          : value.icon && value.icon in HERO_BUTTON_ICONS
            ? value.icon
            : defaultIcon,
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 proposal-builder-card p-5">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>

      <div className="mt-4">
      <label className="block text-sm font-semibold text-slate-700">
        Button text
        <span className="ml-2 font-normal text-slate-400">leave blank to use the default</span>
      </label>
      <input
        type="text"
        placeholder={fallback.label}
        value={value.label}
        onChange={(event) => onChange({ ...value, label: event.target.value })}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
      />

      <p className="mt-4 text-sm font-semibold text-slate-700">Icon</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PLACEMENTS.map((placement) => {
          const selected = value.iconPlacement === placement.id;
          return (
            <button
              key={placement.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPlacement(placement.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                selected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {placement.label}
            </button>
          );
        })}
      </div>

      {value.iconPlacement !== "none" ? (
        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {(Object.entries(HERO_BUTTON_ICONS) as Array<[HeroButtonIconKey, { label: string; Icon: LucideIcon }]>).map(
            ([key, { label, Icon }]) => {
              const selected = value.icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={selected}
                  onClick={() => onChange({ ...value, icon: key })}
                  className={`grid h-9 w-full place-items-center rounded-lg border transition ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            },
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}
