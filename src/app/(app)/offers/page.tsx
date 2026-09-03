import Link from "next/link";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/quotes/format";
import { isOfferKindKey, resumeOfferHref } from "@/lib/quotes/kinds";
import { quoteContactSummaryFromSnapshot } from "@/lib/quotes/clientInfo";
import {
  bucketForStatus,
  outcomeLabel,
  parseArchivedView,
  parseOfferStatusFilter,
  statusesForOfferList,
  type OfferBucket,
} from "@/lib/quotes/status";
import { OfferStatusButtons } from "./OfferStatusButtons";
import { OffersListControls } from "./OffersListControls";
import { OffersFunnel } from "./OffersFunnel";
import { duplicateQuoteAction } from "./actions";
import { OfferContactCell } from "./OfferContactCell";

type SearchParams = Promise<{ sent?: string; contact?: string; status?: string; kind?: string; archived?: string }>;

const BUCKET_STYLE: Record<OfferBucket, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-50 text-slate-500",
};

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireQuoteStaff();
  const params = await searchParams;
  const contactId = typeof params.contact === "string" ? params.contact.trim() : "";
  const archived = parseArchivedView(params.archived);
  const statusFilter = parseOfferStatusFilter(params.status);
  const kindFilter =
    typeof params.kind === "string" && isOfferKindKey(params.kind) ? params.kind : "all";

  const [listed, contacts, contact] = await Promise.all([
    prisma.quote.findMany({
      where: {
        brandId: brand.id,
        status: { in: statusesForOfferList({ archived, statusFilter }) },
        ...(kindFilter === "all" ? {} : { kind: kindFilter }),
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        client: true,
        lineItems: { select: { amount: true, billingType: true } },
      },
    }),
    prisma.contact.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, company: true, email: true },
    }),
    contactId
      ? prisma.contact.findFirst({
          where: { id: contactId, brandId: brand.id },
          select: { id: true, name: true, company: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="px-8 pb-8">
      <h1 className="sr-only">Offers</h1>

      {contact ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Building for</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{contact.name}</p>
          <p className="mt-1 text-base text-slate-500">
            {[contact.company, contact.email].filter(Boolean).join(" · ") || "No company or email on file"}
          </p>
        </div>
      ) : null}

      {params.sent === "1" && (
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-base font-medium text-blue-800">
          Offer marked as sent.
        </div>
      )}

      <section
        className={`${contact || params.sent === "1" ? "mt-10" : ""} -mx-8 px-8 pb-10 pt-8`}
      >
        <h2 className="text-lg font-semibold text-slate-700">Offers tracking</h2>
        <div className="mt-3">
          <OffersFunnel />
        </div>
      </section>

      <section className="-mx-8 px-8 pb-10 pt-8">
        <h2 className="text-lg font-semibold text-slate-700">Manage offers</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <OffersListControls
            archived={archived}
            statusFilter={statusFilter}
            kindFilter={kindFilter}
            contactId={contact?.id}
          />
        {listed.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base text-slate-500">
              {archived ? "No archived offers yet." : "No offers yet."}
            </p>
          </div>
        ) : (
          <table className="w-full text-base">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-5 py-2 text-sm font-semibold normal-case text-slate-700">Contact</th>
                <th className="px-5 py-2 text-sm font-semibold normal-case text-slate-700">Status</th>
                <th className="px-5 py-2 text-sm font-semibold normal-case text-slate-700">Updated</th>
                <th className="px-5 py-2 text-sm font-semibold normal-case text-slate-700">Monthly $</th>
                <th className="px-5 py-2 text-sm font-semibold normal-case text-slate-700">1-time $</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listed.map((quote) => {
                const snapshot =
                  quote.snapshotJson && typeof quote.snapshotJson === "object"
                    ? (quote.snapshotJson as {
                        contactIds?: string[];
                        kind?: string;
                        package?: unknown;
                        pricing?: {
                          maintain?: { monthly?: number; totalOneTime?: number };
                        };
                      })
                    : {};
                const kind = snapshot.kind ?? quote.kind;
                const itemBucket = bucketForStatus(quote.status);
                const canResume = itemBucket === "draft" || !snapshot.package;
                const currentContact = quoteContactSummaryFromSnapshot(quote.snapshotJson, quote.client);
                const monthlyLineItemTotal = quote.lineItems
                  .filter((item) => item.billingType.toLowerCase() === "recurring")
                  .reduce((total, item) => total + Number(item.amount), 0);
                const oneTimeLineItemTotal = quote.lineItems
                  .filter((item) => item.billingType.toLowerCase() === "one_time")
                  .reduce((total, item) => total + Number(item.amount), 0);
                const monthlyTotal =
                  snapshot.pricing?.maintain?.monthly ?? (monthlyLineItemTotal || Number(quote.totalRecurring));
                const oneTimeTotal =
                  snapshot.pricing?.maintain?.totalOneTime ?? (oneTimeLineItemTotal || Number(quote.totalOneTime));
                return (
                  <tr key={quote.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <OfferContactCell
                        offerId={quote.id}
                        currentContact={currentContact}
                        contacts={contacts}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 font-medium ${BUCKET_STYLE[itemBucket]}`}
                      >
                        {outcomeLabel(quote.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {quote.updatedAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {monthlyTotal > 0 ? formatUsd(monthlyTotal) : "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {oneTimeTotal > 0 ? formatUsd(oneTimeTotal) : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={
                            canResume
                              ? resumeOfferHref({ id: quote.id, kind, snapshot })
                              : `/offers/${quote.id}`
                          }
                          className={
                            canResume
                              ? "ui-action-secondary inline-flex h-9 items-center justify-center rounded-full border px-3 text-base font-semibold leading-none transition"
                              : "text-base font-medium text-slate-900 hover:underline"
                          }
                          >
                          {canResume ? "Resume" : "View"}
                        </Link>
                        <form action={duplicateQuoteAction}>
                          <input type="hidden" name="id" value={quote.id} />
                          <button
                            type="submit"
                            className="ui-action-ghost inline-flex h-9 items-center justify-center rounded-full px-3 text-base font-medium leading-none transition"
                          >
                            Duplicate
                          </button>
                        </form>
                        <OfferStatusButtons offerId={quote.id} bucket={itemBucket} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        </div>
      </section>
    </div>
  );
}
