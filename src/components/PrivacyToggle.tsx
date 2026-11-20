"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

/**
 * Hides client names for screen recordings. Stores the choice in a cookie for a
 * year and re-renders the server page, which does the hiding. Off-screen pages
 * pick the choice up on their next load.
 */
export function PrivacyToggle({ on, cookie }: { on: boolean; cookie: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const toggle = () => {
    document.cookie = `${cookie}=${on ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
    // Turning privacy on reloads the whole page: a soft refresh would leave the
    // first load's real names in the page's embedded data.
    if (!on) window.location.reload();
    else startTransition(() => router.refresh());
  };
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      title={on ? "Client names are hidden. Tap to show them." : "Tap to hide client names."}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
        on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
      }`}
    >
      {on ? <EyeOff size={14} /> : <Eye size={14} />}
      {on ? "Privacy on" : "Privacy off"}
    </button>
  );
}
