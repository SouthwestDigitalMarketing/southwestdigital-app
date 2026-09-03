import Link from "next/link";
import { Eye } from "lucide-react";
import type { Prisma } from "@prisma/client";
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
import { OfferContactCell } from "./OfferContactCell";
import { DuplicateOfferButton } from "./DuplicateOfferButton";
import { DuplicateOfferFocus } from "./DuplicateOfferFocus";
import { ClearDuplicateMarkerButton } from "./ClearDuplicateMarkerButton";
import { SendOfferEmailButton } from "./SendOfferEmailButton";

type SortKey = "contact" | "status" | "mrr" | "lump" | "lastSent";
type SearchParams = Promise<{
  sent?: string;
  contact?: string;
  status?: string;
  kind?: string;
  archived?: string;
  sort?: string;
  order?: string;
  highlight?: string;
}>;

const BUCKET_STYLE: Record<OfferBucket, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-50 text-slate-500",
};

function formatOfferDate(date: Date | null) {
  return date
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
}

function daysSinceOfferSent(date: Date | null) {
  if (!date) return "—";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function parseSortKey(value: string | undefined): SortKey {
  if (value === "contact" || value === "status" || value === "mrr" || value === "lump" || value === "lastSent") {
    return value;
  }
  return "lastSent";
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentOrder,
  params,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentOrder: "asc" | "desc";
  params: Awaited<SearchParams>;
}) {
  const nextOrder = currentSort === sortKey && currentOrder === "asc" ? "desc" : "asc";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && key !== "sort" && key !== "order") query.set(key, value);
  }
  query.set("sort", sortKey);
  query.set("order", nextOrder);

  return (
    <th className="px-5 py-2 text-sm font-semibold normal-case text-slate-700">
      <Link href={`/offers?${query.toString()}`} className="inline-flex items-center gap-1 hover:text-slate-950">
        {label}
        {currentSort === sortKey ? <span aria-hidden="true">{currentOrder === "asc" ? "↑" : "↓"}</span> : null}
      </Link>
    </th>
  );
}

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireQuoteStaff();
  const params = await searchParams;
  const contactId = typeof params.contact === "string" ? params.contact.trim() : "";
  const highlightId = typeof params.highlight === "string" ? params.highlight.trim() : "";
  const archived = parseArchivedView(params.archived);
  const statusFilter = parseOfferStatusFilter(params.status);
  const kindFilter =
    typeof params.kind === "string" && isOfferKindKey(params.kind) ? params.kind : "all";
  const sortKey = parseSortKey(params.sort);
  const sortOrder: "asc" | "desc" = params.order === "asc" ? "asc" : "desc";
  const orderBy: Prisma.QuoteOrderByWithRelationInput =
    sortKey === "contact"
      ? { client: { name: sortOrder } }
      : sortKey === "status"
        ? { status: sortOrder }
        : sortKey === "mrr"
          ? { totalRecurring: sortOrder }
          : sortKey === "lump"
            ? { totalOneTime: sortOrder }
            : { sentAt: sortOrder };

  const [listed, contacts, contact] = await Promise.all([
    prisma.quote.findMany({
      where: {
        brandId: brand.id,
        status: { in: statusesForOfferList({ archived, statusFilter }) },
        ...(kindFilter === "all" ? {} : { kind: kindFilter }),
      },
      orderBy,
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
                <SortableHeader label="Contact" sortKey="contact" currentSort={sortKey} currentOrder={sortOrder} params={params} />
                <SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentOrder={sortOrder} params={params} />
                <SortableHeader label="MRR" sortKey="mrr" currentSort={sortKey} currentOrder={sortOrder} params={params} />
                <SortableHeader label="Lump" sortKey="lump" currentSort={sortKey} currentOrder={sortOrder} params={params} />
                <SortableHeader label="Last sent" sortKey="lastSent" currentSort={sortKey} currentOrder={sortOrder} params={params} />
                <th className="px-5 py-2 text-sm font-semibold normal-case text-slate-700">Days ago</th>
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
                        isFreshDuplicate?: boolean;
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
                const isDuplicate = snapshot.isFreshDuplicate === true;
                return (
                  <tr
                    id={`offer-row-${quote.id}`}
                    key={quote.id}
                    className={`hover:bg-slate-50 ${quote.id === highlightId ? "offer-row-highlight" : ""}`}
                  >
                    <td className="relative px-5 py-4">
                      {isDuplicate ? (
                        <>
                          {quote.id === highlightId ? <DuplicateOfferFocus offerId={quote.id} /> : null}
                          <span
                            title={`New duplicate: ${quote.id}`}
                            aria-label={`New duplicate offer ${quote.id}`}
                            className="absolute right-2 top-2 z-10 inline-flex rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-amber-900"
                          >
                            Duplicate
                            <ClearDuplicateMarkerButton offerId={quote.id} />
                          </span>
                        </>
                      ) : null}
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
                    <td className="px-5 py-4 text-slate-700">
                      {monthlyTotal > 0 ? formatUsd(monthlyTotal) : "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {oneTimeTotal > 0 ? formatUsd(oneTimeTotal) : "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatOfferDate(quote.lastSentAt ?? quote.sentAt)}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {daysSinceOfferSent(quote.lastSentAt ?? quote.sentAt)}
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
                        {quote.publicToken ? (
                          <Link
                            href={`/proposal/${quote.publicToken}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label="View proposal"
                            title="View proposal"
                            className="ui-action-ghost inline-flex h-9 w-9 items-center justify-center rounded-full transition"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        ) : (
                          <span
                            aria-label="No published proposal yet"
                            title="No published proposal yet"
                            className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full border border-slate-200 text-slate-300"
                          >
                            <Eye className="h-4 w-4" />
                          </span>
                        )}
                        <SendOfferEmailButton
                          offerId={quote.id}
                        />
                        <OfferStatusButtons offerId={quote.id} bucket={itemBucket} />
                        <DuplicateOfferButton
                          offerId={quote.id}
                          currentContact={currentContact}
                          contacts={contacts}
                          archived={archived}
                        />
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
