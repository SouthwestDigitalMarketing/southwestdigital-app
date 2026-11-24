import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadPendingItems, loadReviewCounts, type SpamRow } from "@/lib/scan/reviews";
import { ReviewList, type ReviewRowView } from "../ReviewList";
import { ReviewResults } from "../ReviewResults";
import { requireMailReviewPage, shortDate } from "../guard";

export const dynamic = "force-dynamic";

/** Spam review (was `scan review` in the terminal): what the spam patrol moved
 * to Spam. Every line starts as spam; tap the ones that are not. */
export default async function SpamReviewPage() {
  await requireMailReviewPage();
  const [items, counts] = await Promise.all([loadPendingItems(prisma, "spam"), loadReviewCounts(prisma)]);
  const rows: ReviewRowView[] = items.map(({ id, data }) => {
    const row = data as SpamRow;
    return {
      id,
      title: row.from,
      detail: row.subject,
      note: [shortDate(row.date), row.why].filter(Boolean).join(" · ") || null,
      defaultAnswer: "spam",
    };
  });
  const waiting = counts.spam.answered;
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <Link href="/scanner" className="text-sm text-slate-500 hover:text-slate-800">Scanner</Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">Spam review</h1>
      {waiting > 0 ? (
        <p className="mt-2 text-sm text-slate-600" role="status">{waiting} answer{waiting === 1 ? "" : "s"} waiting for ripley (within a minute).</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Nothing waiting. All clear.</p>
      ) : (
        <ReviewList
          review="spam"
          rows={rows}
          labels={{
            spam: { word: "Spam", className: "text-slate-500" },
            "not-spam": { word: "Not spam", className: "text-emerald-700" },
          }}
          hint="The patrol moved these to Spam. Tap any that are not spam. Done keeps the rest in Spam (nothing is deleted) and sends those senders straight to Spam from now on; the ones you tapped go back to the Inbox and are never blocked again."
          doneLabel="Done"
        />
      )}
      <ReviewResults reviews={["spam"]} />
    </div>
  );
}
