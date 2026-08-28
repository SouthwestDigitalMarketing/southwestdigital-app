import Link from "next/link";
import { FileText, Handshake, ArrowRight } from "lucide-react";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/quotes/format";
import { OFFER_KINDS, isOfferKindKey, resumeOfferHref, whoHref } from "@/lib/quotes/kinds";
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

type SearchParams = Promise<{ sent?: string; contact?: string; status?: string; kind?: string; archived?: string }>;

const BUCKET_STYLE: Record<OfferBucket, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-50 text-slate-500",
};

const KIND_ICONS: Record<string, typeof FileText> = {
  bookkeeping: FileText,
  "referral-network": Handshake,
};

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireQuoteStaff();
  const params = await searchParams;
  const contactId = typeof params.contact === "string" ? params.contact.trim() : "";
  const archived = parseArchivedView(params.archived);
  const statusFilter = parseOfferStatusFilter(params.status);
  const kindFilter =
    typeof params.kind === "string" && isOfferKindKey(params.kind) ? params.kind : "all";

  const [listed, contact] = await Promise.all([
    prisma.quote.findMany({
      where: {
        brandId: brand.id,
        status: { in: statusesForOfferList({ archived, statusFilter }) },
        ...(kindFilter === "all" ? {} : { kind: kindFilter }),
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { client: true },
    }),
    contactId
      ? prisma.contact.findFirst({
          where: { id: contactId, brandId: brand.id },
          select: { id: true, name: true, company: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  const accentDark = brand.theme?.accentDarkColor ?? brand.theme?.accentColor ?? "#8a5a12";

  return (
    <div className="p-8">
      <h1 className="sr-only">Offers</h1>

      {contact ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-base font-medium tracking-wide text-slate-400">Building for</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{contact.name}</p>
          <p className="mt-1 text-base text-slate-500">
            {[contact.company, contact.email].filter(Boolean).join(" · ") || "No company or email on file"}
          </p>
        </div>
      ) : null}

      {params.sent === "1" && (
        <div className={`${contact ? "mt-8" : ""} rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-base font-medium text-blue-800`}>
          Offer marked as sent.
        </div>
      )}

      <h2 className={`${contact || params.sent === "1" ? "mt-12" : ""} text-2xl font-medium text-slate-500`}>
        Create an offer
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {OFFER_KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind.key] ?? FileText;
          return (
            <Link
              key={kind.key}
              href={whoHref(kind.key, contact?.id)}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 transition hover:border-slate-400"
            >
              <div className="flex items-center gap-3">
                <div className="offer-kind-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <Icon size={18} />
                </div>
                <p className="text-xl font-semibold text-slate-900">{kind.name}</p>
              </div>
              <p className="mt-4 flex-1 text-base leading-6 text-slate-500">{kind.summary}</p>
              <span className="mt-5 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-slate-300 bg-transparent px-3 py-2 text-base font-medium leading-5 text-slate-900">
                Create & send a {kind.name.toLowerCase()} offer to a contact
                <ArrowRight size={16} className="shrink-0 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-12 text-2xl font-medium text-slate-500">Offers tracking</h2>
      <div className="mt-4">
        <OffersFunnel />
      </div>

      <h2 className="mt-12 text-2xl font-medium text-slate-500">
        {archived ? "Archived offers" : "Offers"}
      </h2>
      <div className="mt-4">
        <OffersListControls
          archived={archived}
          statusFilter={statusFilter}
          kindFilter={kindFilter}
          contactId={contact?.id}
        />
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {listed.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-base text-slate-500">
              {archived ? "No archived offers yet." : "No offers yet."}
            </p>
          </div>
        ) : (
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3.5 font-medium tracking-wide text-slate-400">Client</th>
                <th className="px-5 py-3.5 font-medium tracking-wide text-slate-400">Type</th>
                <th className="px-5 py-3.5 font-medium tracking-wide text-slate-400">Status</th>
                <th className="px-5 py-3.5 font-medium tracking-wide text-slate-400">Updated</th>
                <th className="px-5 py-3.5 font-medium tracking-wide text-slate-400">Amount</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listed.map((quote) => {
                const snapshot =
                  quote.snapshotJson && typeof quote.snapshotJson === "object"
                    ? (quote.snapshotJson as { contactIds?: string[]; kind?: string; package?: unknown })
                    : {};
                const kind = snapshot.kind ?? quote.kind;
                const kindLabel =
                  OFFER_KINDS.find((item) => item.key === kind)?.name ?? "Offer";
                const itemBucket = bucketForStatus(quote.status);
                const canResume = itemBucket === "draft" || !snapshot.package;
                return (
                  <tr key={quote.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{quote.client.name}</div>
                      {quote.client.company ? (
                        <div className="mt-0.5 text-base text-slate-500">{quote.client.company}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{kindLabel}</td>
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
                      {Number(quote.totalOneTime) > 0 || Number(quote.totalRecurring) > 0
                        ? `${formatUsd(quote.totalOneTime)}${
                            Number(quote.totalRecurring) > 0
                              ? ` + ${formatUsd(quote.totalRecurring)}/mo`
                              : ""
                          }`
                        : "—"}
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
                              ? "inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-slate-300 px-3 text-base font-semibold leading-none text-white transition hover:opacity-90"
                              : "text-base font-medium text-slate-900 hover:underline"
                          }
                          style={canResume ? { backgroundColor: accentDark } : undefined}
                        >
                          {canResume ? "Resume" : "View"}
                        </Link>
                        <OfferStatusButtons offerId={quote.id} status={quote.status} bucket={itemBucket} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
