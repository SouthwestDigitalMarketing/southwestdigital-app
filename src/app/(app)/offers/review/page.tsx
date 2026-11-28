import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { quoteContactSummaryFromSnapshot } from "@/lib/quotes/clientInfo";
import { isQuoteFrozen, quoteFreezeSelect } from "@/lib/quotes/isQuoteFrozen";
import { staffDateKey } from "@/lib/quotes/staffDates";
import { expireReviewQuotesAction } from "./actions";
import { oldLinksReviewOrderBy, oldLinksReviewWhere } from "./query";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function OldLinksReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; skipped?: string }>;
}) {
  const { brand } = await requireQuoteStaff();
  const params = await searchParams;
  const expiredCount = Number(params.expired ?? "");
  const skippedCount = Number(params.skipped ?? "");
  const nowMs = new Date().getTime();
  const fetched = await prisma.quote.findMany({
    where: oldLinksReviewWhere(brand.id),
    orderBy: oldLinksReviewOrderBy,
    take: 100,
    select: {
      id: true,
      offerCode: true,
      sentAt: true,
      firstSentAt: true,
      publicToken: true,
      snapshotJson: true,
      ...quoteFreezeSelect,
      client: { select: { name: true, email: true, company: true } },
    },
  });
  // The query cannot exclude engagement-level freezes null-safely in Prisma
  // (acceptance lives on engagement.onboardingData), so reuse isQuoteFrozen
  // exactly as the expire action does, before render.
  const rows = fetched.filter((row) => !isQuoteFrozen(row));

  return (
    <div className="px-8 pb-8">
      <div className="mx-auto mt-8 max-w-5xl space-y-6">
        <div>
          <Link href="/offers" className="text-xs text-slate-400 hover:underline">
            ← All Offers
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Review old proposal links</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sent, unaccepted proposals with no expiry, oldest first. Nothing expires without a
            click — each row expires only via its button or the selected batch.
          </p>
          {Number.isFinite(expiredCount) && expiredCount > 0 ? (
            <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
              Expired {expiredCount} {expiredCount === 1 ? "proposal" : "proposals"}.
              {Number.isFinite(skippedCount) && skippedCount > 0
                ? ` Skipped ${skippedCount} already accepted, signed or paid.`
                : ""}
            </p>
          ) : Number.isFinite(skippedCount) && skippedCount > 0 ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              Skipped {skippedCount} {skippedCount === 1 ? "proposal" : "proposals"} already
              accepted, signed or paid — nothing was expired.
            </p>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No sent proposals are missing an expiry. You are caught up.
          </p>
        ) : (
          <>
            <form id="expire-selected-form" action={expireReviewQuotesAction}>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Expire selected ({rows.length} shown)
              </button>
            </form>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-sm font-semibold text-slate-700">
                    <th className="px-4 py-2"><span className="sr-only">Select</span></th>
                    <th className="px-4 py-2">Proposal</th>
                    <th className="px-4 py-2">Sent</th>
                    <th className="px-4 py-2">Age</th>
                    <th className="px-4 py-2">Link</th>
                    <th className="px-4 py-2"><span className="sr-only">Expire</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row) => {
                    const summary = quoteContactSummaryFromSnapshot(row.snapshotJson, row.client);
                    const sentAt = row.firstSentAt ?? row.sentAt;
                    const ageDays = sentAt
                      ? Math.max(0, Math.floor((nowMs - sentAt.getTime()) / DAY_MS))
                      : null;
                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            name="ids"
                            value={row.id}
                            form="expire-selected-form"
                            aria-label={`Select ${summary.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{summary.name}</div>
                          <div className="text-xs text-slate-400">
                            {summary.company ?? row.client.company ?? row.offerCode}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {sentAt ? staffDateKey(sentAt) : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {ageDays === null ? "—" : `${ageDays}d`}
                        </td>
                        <td className="px-4 py-3">
                          {row.publicToken ? (
                            <a
                              href={`/proposal/${row.publicToken}?staffPreview=1`}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              Open link
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <form action={expireReviewQuotesAction}>
                            <input type="hidden" name="ids" value={row.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Expire now
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
