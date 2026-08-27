import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { formatUsd, SCENARIO_LABELS } from "@/lib/quotes/format";
import { markQuoteSentAction } from "../actions";
import type { QuoteSnapshot } from "@/lib/quotes/types";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; sent?: string }>;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  accepted: "bg-emerald-50 text-emerald-700",
  expired: "bg-amber-50 text-amber-700",
};

export default async function QuoteDetailPage({ params, searchParams }: PageProps) {
  const { brand } = await requireQuoteStaff();
  const { id } = await params;
  const sp = await searchParams;

  const quote = await prisma.quote.findFirst({
    where: { id, brandId: brand.id },
    include: {
      client: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quote) notFound();

  const snapshot = quote.snapshotJson as QuoteSnapshot;
  if (!snapshot?.package || !snapshot.client) notFound();

  const banner =
    sp.created === "1"
      ? {
          msg: "Quote generated successfully.",
          tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
        }
      : sp.sent === "1"
        ? { msg: "Quote marked as sent.", tone: "border-blue-200 bg-blue-50 text-blue-800" }
        : null;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/offers" className="text-xs text-slate-400 hover:underline">
              ← All Offers
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Offer</h1>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[quote.status] ?? "bg-slate-100 text-slate-600"}`}
          >
            {quote.status}
          </span>
        </div>

        {banner && (
          <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${banner.tone}`}>
            {banner.msg}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Client
            </div>
            <div className="text-base font-semibold text-slate-800">{quote.client.name}</div>
            {quote.client.company && (
              <div className="text-sm text-slate-500">{quote.client.company}</div>
            )}
            <div className="text-sm text-slate-500">{quote.client.email}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Package
            </div>
            <div className="text-base font-semibold text-slate-800">{snapshot.package.name}</div>
            <div className="text-sm text-slate-500">
              {SCENARIO_LABELS[snapshot.package.scenario] ?? snapshot.package.scenario}
            </div>
            {snapshot.package.highlightLabel && (
              <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {snapshot.package.highlightLabel}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Totals</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">One-time</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {formatUsd(quote.totalOneTime)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Monthly</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {Number(quote.totalRecurring) > 0 ? `${formatUsd(quote.totalRecurring)}/mo` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Onboarding</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {Number(quote.onboardingFee) > 0 ? formatUsd(quote.onboardingFee) : "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">Line Items</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-6 py-2">Label</th>
                <th className="px-6 py-2">Type</th>
                <th className="px-6 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {quote.lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-3">
                    <div className="font-medium text-slate-800">{item.label}</div>
                    {item.description && (
                      <div className="text-xs text-slate-400">{item.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
                      {item.billingType.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-slate-800">
                    {formatUsd(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {snapshot.features.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-3 text-base font-semibold text-slate-800">Included</h2>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {snapshot.features.map((feature) => (
                <li key={feature.id}>{feature.shortLabel}</li>
              ))}
            </ul>
          </div>
        )}

        {snapshot.inputs && Object.keys(snapshot.inputs).length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-3 text-base font-semibold text-slate-800">Inputs Used</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(snapshot.inputs).map(([key, value]) =>
                value !== undefined && value !== null ? (
                  <div key={key} className="flex gap-2">
                    <dt className="capitalize text-slate-400">{key.replace(/_/g, " ")}:</dt>
                    <dd className="font-medium text-slate-700">{String(value)}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="self-center text-xs text-slate-400">
            Slug: <code className="font-mono">{quote.slug}</code>
          </span>
          {quote.status === "draft" && (
            <form action={markQuoteSentAction}>
              <input type="hidden" name="id" value={quote.id} />
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Mark as sent
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
