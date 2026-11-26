import { Info } from "lucide-react";
import type { Bucket, SortedItem } from "@/lib/donna/domain";

/*
 * The sorted-email table (Tom, 2026-11-26): one row per email, grouped by bucket,
 * soft tint per bucket with alternating shades, Type with a group dot and hover
 * text, the reason behind an info icon. Shared by the live sort and the Choose step.
 */

export const BUCKET_TINTS = [
  ["bg-sky-50", "bg-sky-100/60"],
  ["bg-amber-50", "bg-amber-100/60"],
  ["bg-emerald-50", "bg-emerald-100/60"],
  ["bg-violet-50", "bg-violet-100/60"],
  ["bg-rose-50", "bg-rose-100/60"],
  ["bg-teal-50", "bg-teal-100/60"],
  ["bg-orange-50", "bg-orange-100/60"],
  ["bg-indigo-50", "bg-indigo-100/60"],
];

export function rowTint(bucket: number, row: number) {
  return BUCKET_TINTS[bucket % BUCKET_TINTS.length][row % 2];
}

/** One colour per type group, so a scam or a money email stands out. */
const TYPE_DOTS: Record<string, string> = {
  People: "bg-sky-500",
  Money: "bg-emerald-500",
  Systems: "bg-slate-500",
  Marketing: "bg-violet-500",
  Unwanted: "bg-rose-500",
  Other: "bg-slate-300",
};

/** Sender's name, or the address when there is no name. */
export function senderName(from: string) {
  const name = from
    .replace(/<[^>]*>/, "")
    .replace(/"/g, "")
    .trim();
  return name || from;
}

export const th = "px-2 py-1 font-semibold";
export const td = "px-2 py-1";

export function TypeCell({ item }: { item: SortedItem }) {
  if (!item.type) return null;
  return (
    <span
      title={item.typeHint || item.type}
      className="inline-flex items-center gap-1"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${TYPE_DOTS[item.typeGroup] ?? TYPE_DOTS.Other}`}
      />
      {item.type}
      {item.typeNew ? (
        <span className="rounded bg-slate-900 px-1 text-[10px] leading-4 text-white">
          new
        </span>
      ) : null}
    </span>
  );
}

export function WhyCell({ why }: { why: string }) {
  if (!why) return null;
  // Hover (or focus) shows Donna's reason.
  return (
    <span
      role="img"
      tabIndex={0}
      title={why}
      aria-label={`Why: ${why}`}
      className="inline-flex cursor-help hover:text-slate-700 focus:text-slate-700"
    >
      <Info size={14} aria-hidden="true" />
    </span>
  );
}

/** The email columns after the first: Email, Type, From, Client, Why. */
export function EmailCells({ item }: { item: SortedItem }) {
  return (
    <>
      <td className={`max-w-[16rem] truncate ${td}`}>{item.subject}</td>
      <td className={`whitespace-nowrap ${td} text-slate-600`}>
        <TypeCell item={item} />
      </td>
      <td
        className={`max-w-[12rem] truncate ${td} text-slate-600`}
        title={item.from}
      >
        {senderName(item.from)}
      </td>
      <td className={`whitespace-nowrap ${td} text-slate-600`}>
        {item.client ?? ""}
      </td>
      <td className={`${td} text-slate-400`}>
        <WhyCell why={item.why} />
      </td>
    </>
  );
}

export function EmailHeads() {
  return (
    <>
      <th className={th}>Email</th>
      <th className={th}>Type</th>
      <th className={th}>From</th>
      <th className={th}>Client</th>
      <th className={`w-8 ${th}`}>
        <span className="sr-only">Why</span>
      </th>
    </>
  );
}

/** Read-only: the sort filling in live, or a finished sort looked back on. */
export function SortedTable({ buckets }: { buckets: Bucket[] }) {
  if (!buckets.length)
    return (
      <p className="text-sm text-slate-500">
        Emails appear here as Donna sorts each one.
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table
        aria-label="Sorted emails"
        className="w-full min-w-[640px] text-left text-xs"
      >
        <thead className="uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th className={th}>Bucket</th>
            <EmailHeads />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {buckets.flatMap((bucket, b) =>
            bucket.items.map((item, i) => (
              <tr key={item.thread} className={`align-top ${rowTint(b, i)}`}>
                <td className={`whitespace-nowrap ${td} font-medium`}>
                  {i ? "" : `${bucket.name} (${bucket.items.length})`}
                </td>
                <EmailCells item={item} />
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
