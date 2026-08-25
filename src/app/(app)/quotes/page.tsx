import Link from "next/link";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/quotes/format";

type SearchParams = Promise<{ sent?: string }>;

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  accepted: "bg-emerald-50 text-emerald-700",
  expired: "bg-amber-50 text-amber-700",
};

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireQuoteStaff();
  const params = await searchParams;

  const quotes = await prisma.quote.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { client: true },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Quotes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Build pricing with the generator, then save a snapshot for this brand.
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-700"
        >
          New Quote
        </Link>
      </div>

      {params.sent === "1" && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          Quote marked as sent.
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {quotes.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-400">No quotes yet.</p>
            <Link
              href="/quotes/new"
              className="mt-3 inline-block text-sm font-medium text-slate-900 hover:underline"
            >
              Build your first quote →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Client
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  One-time
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recurring
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Created
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{quote.client.name}</div>
                    {quote.client.company && (
                      <div className="text-xs text-slate-400">{quote.client.company}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[quote.status] ?? "bg-slate-100 text-slate-500"}`}
                    >
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{formatUsd(quote.totalOneTime)}</td>
                  <td className="px-5 py-3 text-slate-700">
                    {Number(quote.totalRecurring) > 0
                      ? `${formatUsd(quote.totalRecurring)}/mo`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {quote.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="text-xs font-medium text-slate-900 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
