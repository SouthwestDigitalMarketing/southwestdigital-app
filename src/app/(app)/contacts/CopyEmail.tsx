"use client";

import { useState } from "react";

export function CopyEmail({
  email,
  fallback,
}: {
  email: string | null;
  fallback?: string;
}) {
  const [copied, setCopied] = useState(false);
  const display = email || fallback || "—";

  if (!email) {
    return <span className="text-slate-600">{display}</span>;
  }

  return (
    <span className="group relative inline-flex max-w-full">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(email);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            setCopied(false);
          }
        }}
        className="max-w-full cursor-pointer truncate text-left text-slate-600 hover:text-slate-800"
      >
        {email}
      </button>
      <span
        className={`pointer-events-none absolute left-0 top-full z-20 mt-1 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-sm ${
          copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {copied ? "Email copied to clipboard" : "Click to copy"}
      </span>
    </span>
  );
}
