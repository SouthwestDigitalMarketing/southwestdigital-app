import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadPendingItems, loadReviewCounts, newsletterDefault, type NewsletterRow } from "@/lib/scan/reviews";
import { ReviewList, type ReviewRowView } from "../ReviewList";
import { ReviewResults } from "../ReviewResults";
import { requireMailReviewPage, shortDate } from "../guard";
import { UndoClear } from "./UndoClear";

export const dynamic = "force-dynamic";

function why(row: NewsletterRow): string | null {
  if (row.suggest) return `Keep: ${row.suggest}`;
  if (row.protected) return "Keep: on the never-block list";
  if (row.reply) return "Keep: a person replying";
  return null;
}

/** Newsletter review (was `scan review` / the chat table): one line per sender
 * in Zoho's Newsletter folder. The plan is filled in: keep payment and receipt
 * mail, the never-block list and people replying; clear the rest. */
export default async function NewsletterReviewPage() {
  await requireMailReviewPage();
  const [items, counts] = await Promise.all([loadPendingItems(prisma, "newsletter"), loadReviewCounts(prisma)]);
  const rows: ReviewRowView[] = items.map(({ id, data }) => {
    const row = data as NewsletterRow;
    const newest = row.subjects[0] ?? "";
    return {
      id,
      title: row.name ? `${row.name} <${row.addr}>` : row.addr,
      detail: `${row.count} email${row.count === 1 ? "" : "s"}${newest ? ` · ${newest}` : ""}`,
      note: [shortDate(row.date), why(row)].filter(Boolean).join(" · ") || null,
      defaultAnswer: newsletterDefault(row),
    };
  });
  const waiting = counts.newsletter.answered;
  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <Link href="/scanner" className="text-sm text-slate-500 hover:text-slate-800">Scanner</Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">Newsletter review</h1>
      {waiting > 0 ? (
        <p className="mt-2 text-sm text-slate-600" role="status">{waiting} answer{waiting === 1 ? "" : "s"} waiting for ripley (within a minute).</p>
      ) : null}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Nothing waiting. All clear.</p>
      ) : (
        <ReviewList
          review="newsletter"
          rows={rows}
          labels={{
            keep: { word: "Keep", className: "text-emerald-700" },
            clear: { word: "Clear", className: "text-rose-700" },
          }}
          hint="I'd keep the ones marked Keep and clear the rest. Tap a line to change it. Clearing a sender unsubscribes it, sends that exact address straight to Spam from now on, and moves its Newsletter mail to Trash (Zoho keeps Trash 30 days). Kept senders are not asked about again."
          doneLabel="Apply"
        />
      )}
      <UndoClear />
      <ReviewResults reviews={["newsletter", "newsletter-undo"]} />
    </div>
  );
}
