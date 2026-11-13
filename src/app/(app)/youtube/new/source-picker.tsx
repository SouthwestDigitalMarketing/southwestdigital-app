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
  const [onPhone, setOnPhone] = useState(false);
  const [origin, setOrigin] = useState("");

  return (
    <section className="mt-8">
      <div className="grid gap-3 lg:grid-cols-3">
        {sources.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={source === item.id}
            onClick={() => {
              setSource(item.id);
              if (item.id === "phone") {
                setOnPhone(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
                setOrigin(window.location.origin);
              }
            }}
            className={`rounded-2xl border p-5 text-left hover:border-slate-500 ${source === item.id ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"}`}
          >
            <span className="block font-semibold text-slate-900">{item.title}</span>
            <span className="mt-1 block text-sm text-slate-600">{item.detail}</span>
          </button>
        ))}
      </div>
      {source === "phone" ? (
        <div className="mt-6 rounded-2xl bg-slate-50 p-5">
          <h2 className="font-semibold text-slate-900">The video is on your phone</h2>
          {onPhone ? (
            <>
              <p className="mt-2 text-sm text-slate-600">Choose the video and any photos on this phone. You will see a receipt when each file reaches ripley.</p>
              <a className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white" href="/phone">Send files from this phone</a>
            </>
          ) : (
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>On your phone, open this site and sign in: <span className="font-semibold break-all">{origin}</span></li>
              <li>Tap <span className="font-semibold">Create new video</span>, then <span className="font-semibold">My phone</span>.</li>
              <li>Tap <span className="font-semibold">Send files from this phone</span> and pick the video and photos.</li>
              <li>Each file shows a receipt when it reaches ripley. You can leave this page open here.</li>
            </ol>
          )}
        </div>
      ) : source === "canon" ? (
        <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">Keep the full SD card structure. The card copy step is still being connected to this screen.</p>
      ) : source === "ripley" ? (
        <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">The ripley file picker is still being connected to this screen.</p>
      ) : null}
    </section>
  );
}
