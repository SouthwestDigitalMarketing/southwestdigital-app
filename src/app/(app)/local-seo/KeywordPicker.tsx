"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Search-phrase picker kept in ?q= so Map and Trends open on the same phrase. */
export function useKeyword(keywords: string[]) {
  const params = useSearchParams();
  const asked = params.get("q");
  return asked && keywords.includes(asked) ? asked : keywords[0] ?? "";
}

export function KeywordPicker({ keywords, value }: { keywords: string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      value={value}
      onChange={(event) => router.replace(`${pathname}?q=${encodeURIComponent(event.target.value)}`, { scroll: false })}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      aria-label="Search phrase"
    >
      {keywords.map((keyword) => <option key={keyword} value={keyword}>{keyword}</option>)}
    </select>
  );
}
