"use client";

import { useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { Modal } from "@/components/Modal";

const CHANNELS = [
  { name: "Facebook", href: "https://adsmanager.facebook.com/adsmanager/" },
  { name: "YouTube", href: null },
  { name: "Google", href: null },
] as const;

export function CreateAdButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ui-action-primary inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition"
      >
        <Plus size={16} /> Create ad
      </button>

      {open ? (
        <Modal onClose={() => setOpen(false)} labelledBy="create-ad-title" className="max-w-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <h2 id="create-ad-title" className="text-lg font-semibold text-slate-900">Which channel?</h2>
              <button
                type="button"
                aria-label="Close"
                title="Close"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <ul className="mt-4 grid gap-2">
              {CHANNELS.map((channel) => (
                <li key={channel.name}>
                  {channel.href ? (
                    <a
                      href={channel.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-base font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      {channel.name}
                      <ExternalLink size={16} className="text-slate-400" />
                    </a>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="flex cursor-not-allowed items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-400"
                    >
                      {channel.name}
                      <span className="text-xs font-medium">Coming soon</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
