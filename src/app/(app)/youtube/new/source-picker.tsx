"use client";

import { useState } from "react";

type Source = "phone" | "canon" | "ripley";

const sources: { id: Source; title: string; detail: string }[] = [
  { id: "phone", title: "My phone", detail: "Video, photos, and other media on your phone" },
  { id: "canon", title: "Canon C100 SD card", detail: "Camera files and the full card structure" },
  { id: "ripley", title: "Already on ripley", detail: "Files that have already been copied to the video computer" },
];

export function SourcePicker() {
  const [source, setSource] = useState<Source | null>(null);

  return (
    <section className="mt-8">
      <div className="grid gap-3">
        {sources.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={source === item.id}
            onClick={() => setSource(item.id)}
            className={`rounded-2xl border p-5 text-left hover:border-slate-500 ${source === item.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"}`}
          >
            <span className="block font-semibold text-slate-900">{item.title}</span>
            <span className="mt-1 block text-sm text-slate-600">{item.detail}</span>
          </button>
        ))}
      </div>
      {source === "phone" ? (
        <div className="mt-6 rounded-2xl bg-slate-50 p-5">
          <h2 className="font-semibold text-slate-900">Send the files from your phone</h2>
          <p className="mt-2 text-sm text-slate-600">Choose the video on your phone. The upload page will give you a file receipt when it reaches ripley.</p>
          <a className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white" href="http://100.98.89.93:8931/">Open phone upload</a>
        </div>
      ) : source === "canon" ? (
        <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">Keep the full SD card structure. The card copy step is still being connected to this screen.</p>
      ) : source === "ripley" ? (
        <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">The ripley file picker is still being connected to this screen.</p>
      ) : null}
    </section>
  );
}
