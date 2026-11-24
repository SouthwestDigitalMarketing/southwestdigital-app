import { loadRecentResults } from "@/lib/scan/reviews";
import { prisma } from "@/lib/prisma";

const WORDS: Record<string, string> = {
  spam: "Spam",
  "not-spam": "Back to Inbox",
  keep: "Kept",
  clear: "Cleared",
  undo: "Undo last clear",
};

/** What ripley did with the answers in the last 24 hours; failures first. */
export async function ReviewResults({ reviews }: { reviews: string[] }) {
  const rows = await loadRecentResults(prisma, reviews);
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => (a.status === "failed" ? 0 : 1) - (b.status === "failed" ? 0 : 1));
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Done in the last 24 hours</h2>
      <ol className="mt-2 space-y-1 text-sm">
        {sorted.map((row, index) => (
          <li key={row.id} className="flex min-w-0 items-baseline gap-2">
            <span className="w-7 shrink-0 text-right tabular-nums text-slate-400">{index + 1}.</span>
            <span className={row.status === "failed" ? "text-rose-700" : "text-emerald-700"}>{row.status === "failed" ? "!" : "✓"}</span>
            <span className="min-w-0 flex-1 break-words text-slate-700">
              {WORDS[row.answer ?? ""] ?? row.answer}
              {row.review === "newsletter" ? ` — ${row.itemKey}` : row.review === "spam" ? ` — no. ${row.itemKey}` : ""}
              {row.status === "failed" && row.result ? <span className="block text-xs text-rose-700">{row.result}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
