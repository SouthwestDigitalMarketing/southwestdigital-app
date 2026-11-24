"use client";

import { Eye, EyeOff } from "lucide-react";
import { PRIVACY_COOKIE } from "@/lib/privacy";

/**
 * The app-wide privacy switch. Stores the choice in a cookie for a year and
 * reloads the whole page: the server does the hiding, and a soft refresh would
 * leave the last render's real names in the page's embedded data.
 *
 * `compact` drops the label while privacy is off (the phone header); "Privacy on"
 * always shows its label so it is obvious. `iconOnly` never shows a label (the
 * collapsed sidebar). `label` replaces the text, for buttons that read as an
 * action ("Turn privacy off").
 */
export function PrivacyToggle({
  on,
  compact = false,
  iconOnly = false,
  sidebarAction = false,
  label,
}: {
  on: boolean;
  compact?: boolean;
  iconOnly?: boolean;
  sidebarAction?: boolean;
  label?: string;
}) {
  const toggle = () => {
    document.cookie = `${PRIVACY_COOKIE}=${on ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  const showLabel = !iconOnly && (on || !compact);
  const buttonShape = sidebarAction
    ? "justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium"
    : `h-8 gap-1.5 rounded-full text-xs font-semibold ${showLabel ? "px-3" : "w-8 justify-center"}`;
  const inactiveColors = sidebarAction
    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100";
  const Icon = on ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Privacy on: client names are hidden" : "Privacy off: tap to hide client names"}
      title={on ? "Client names are hidden. Tap to show them." : "Hide client names for screen recordings"}
      className={`inline-flex shrink-0 items-center border transition-colors ${buttonShape} ${
        on ? "border-violet-600 bg-violet-600 text-white hover:bg-violet-700" : inactiveColors
      }`}
    >
      <Icon size={sidebarAction ? 15 : 14} aria-hidden />
      {showLabel ? (label ?? (on ? "Privacy on" : "Privacy off")) : null}
    </button>
  );
}
