"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateToolLinksAction } from "./actions";
import type { ToolLink } from "@/lib/brands/tools";

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

const HINTS: Record<string, string> = {
  quickbooks: "Bookkeeping / accounting app",
  double: "Client document collection",
  calendar: "Shared or personal calendar",
  mail: "Inbox",
  skool: "Community / courses",
};

export function ToolLinksForm({ links }: { links: ToolLink[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      key={links.map((link) => `${link.key}:${link.label}:${link.url}`).join("|")}
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          try {
            await updateToolLinksAction(data);
            setSaved(true);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save tool links");
          }
        });
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-slate-800">Sidebar tools</h2>
        <p className="mt-1 text-sm text-slate-500">
          These open in a new tab under Settings. Change the URL if this brand uses a different
          platform. Clear a URL to hide that item from the sidebar.
        </p>
      </div>

      <div className="space-y-4">
        {links.map((link) => (
          <div key={link.key} className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Label
              <input
                name={`label-${link.key}`}
                defaultValue={link.label}
                maxLength={40}
                required
                className={inputClass}
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              URL
              <input
                name={`url-${link.key}`}
                defaultValue={link.url}
                inputMode="url"
                autoComplete="url"
                placeholder="https://"
                className={inputClass}
              />
              <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-slate-400">
                {HINTS[link.key] ?? "Opens in a new tab"}
              </span>
            </label>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Saved. Sidebar links are updated.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save links"}
      </button>
    </form>
  );
}
