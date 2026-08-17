"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function LiveButton({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isActive = current === "today";

  function activate() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", "today");
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="relative group">
      <button
        onClick={activate}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
          isActive
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"
        }`}
      >
        Today
      </button>

      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
        <p className="font-semibold text-slate-800">Today so far</p>
        <p className="mt-1 leading-relaxed">
          Hourly activity on your site today, compared to the same hours yesterday.
        </p>
      </div>
    </div>
  );
}
