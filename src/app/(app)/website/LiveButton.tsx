"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function LiveButton({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isActive = current === "live";

  function activate() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", "live");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="relative group">
      <button
        onClick={activate}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          isActive
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
        }`}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {isActive && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              isActive ? "bg-white" : "bg-emerald-500"
            }`}
          />
        </span>
        Live
      </button>

      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
        <p className="font-semibold text-slate-800">Real-time visitors</p>
        <p className="mt-1 leading-relaxed">
          Shows visitors active on your site in the last 30 minutes. Refreshes automatically every 30 seconds.
        </p>
      </div>
    </div>
  );
}
