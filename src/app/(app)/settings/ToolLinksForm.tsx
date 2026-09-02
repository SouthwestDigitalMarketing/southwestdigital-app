"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateToolLinksAction } from "./actions";
import type { ToolLink } from "@/lib/brands/tools";

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-slate-500 focus:outline-none";


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
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sidebar tools</h2>
        <p className="mt-1 text-base text-slate-500">
          These open in a new tab under Settings. Change the URL if this brand uses a different
          platform. Clear a URL to hide that item from the sidebar.
        </p>
      </div>

      <div className="space-y-4">
        {links.map((link) => (
          <div key={link.key} className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <label className="text-base font-semibold text-slate-600">
              Label
              <input
                name={`label-${link.key}`}
                defaultValue={link.label}
                maxLength={40}
                required
                className={inputClass}
              />
            </label>
            <label className="text-base font-semibold text-slate-600">
              URL
              <input
                name={`url-${link.key}`}
                defaultValue={link.url}
                inputMode="url"
                autoComplete="url"
                placeholder="https://"
                className={inputClass}
              />

            </label>
          </div>
        ))}
      </div>

      {error ? <p className="text-base text-red-600">{error}</p> : null}
      {saved ? <p className="text-base text-emerald-700">Saved. Sidebar links are updated.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="ui-action-primary rounded-md px-4 py-2 text-base font-medium transition disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save links"}
      </button>
    </form>
  );
}
