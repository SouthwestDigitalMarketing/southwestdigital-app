import Link from "next/link";
import { FileText, Handshake, ArrowRight } from "lucide-react";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/quotes/format";
import { OFFER_KINDS, builderHref, isOfferKindKey, parseContactIds, whoHref } from "@/lib/quotes/kinds";
import {
  BUCKET_LABEL,
  bucketForStatus,
  outcomeLabel,
  parseOfferBucket,
  statusesForBucket,
  type OfferBucket,
} from "@/lib/quotes/status";
import { OfferStatusButtons } from "./OfferStatusButtons";

type SearchParams = Promise<{ sent?: string; contact?: string; bucket?: string }>;

const BUCKET_STYLE: Record<OfferBucket, string> = {
  draft: "bg-slate-100 text-slate-600",
  completed: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-50 text-slate-500",
};

const KIND_ICONS: Record<string, typeof FileText> = {
  bookkeeping: FileText,
  "referral-network": Handshake,
};

function resumeHref(kind: string, contactIds: string[], offerId: string) {
  const offerKind = isOfferKindKey(kind) ? kind : "bookkeeping";
  return builderHref(offerKind, contactIds, offerId);
}

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand } = await requireQuoteStaff();
  const params = await searchParams;
  const contactId = typeof params.contact === "string" ? params.contact.trim() : "";
  const bucket = parseOfferBucket(params.bucket);

  const [grouped, listed, contact] = await Promise.all([
    prisma.quote.groupBy({
      by: ["status"],
      where: { brandId: brand.id },
      _count: { _all: true },
    }),
    prisma.quote.findMany({
      where: { brandId: brand.id, status: { in: statusesForBucket(bucket) } },
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

  const countFor = (next: OfferBucket) =>
    grouped
      .filter((row) => statusesForBucket(next).includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);

  function bucketHref(next: OfferBucket) {
    const qs = new URLSearchParams();
    qs.set("bucket", next);
    if (contact?.id) qs.set("contact", contact.id);
    return `/offers?${qs.toString()}`;
  }

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Offers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Start a new offer, or reopen one that is already in progress
          {contact ? ` for ${contact.name}` : ""}.
        </p>
      </div>

      {contact ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Building for</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{contact.name}</p>
          <p className="text-sm text-slate-500">
            {[contact.company, contact.email].filter(Boolean).join(" · ") || "No company or email on file"}
          </p>
        </div>
      ) : null}

      {params.sent === "1" && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          Offer marked as sent.
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-4">
        {(["draft", "completed", "archived"] as const).map((next) => {
          const active = bucket === next;
          return (
            <Link
              key={next}
              href={bucketHref(next)}
              className={`rounded-xl border p-5 transition ${
                active ? "border-slate-900 bg-white" : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {BUCKET_LABEL[next]}
              </p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{countFor(next)}</p>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-10 text-base font-semibold text-slate-900">Choose an offer</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {OFFER_KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind.key] ?? FileText;
          return (
            <Link
              key={kind.key}
              href={whoHref(kind.key, contact?.id)}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 transition hover:border-slate-400"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Icon size={18} />
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-900">{kind.name}</p>
              <p className="mt-1 flex-1 text-sm text-slate-500">{kind.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-900">
                Build this offer
                <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">{BUCKET_LABEL[bucket]} offers</h2>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {listed.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-400">No {BUCKET_LABEL[bucket].toLowerCase()} offers yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Client
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Updated
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listed.map((quote) => {
                const snapshot =
                  quote.snapshotJson && typeof quote.snapshotJson === "object"
                    ? (quote.snapshotJson as { contactIds?: string[]; kind?: string; package?: unknown })
                    : {};
                const contactIds = parseContactIds(snapshot.contactIds);
                const kind = snapshot.kind ?? quote.kind;
                const kindLabel =
                  OFFER_KINDS.find((item) => item.key === kind)?.name ?? "Offer";
                const itemBucket = bucketForStatus(quote.status);
                const canResume = itemBucket === "draft" || !snapshot.package;
                return (
                  <tr key={quote.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{quote.client.name}</div>
                      {quote.client.company ? (
                        <div className="text-xs text-slate-400">{quote.client.company}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{kindLabel}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${BUCKET_STYLE[itemBucket]}`}
                      >
                        {outcomeLabel(quote.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {quote.updatedAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {Number(quote.totalOneTime) > 0 || Number(quote.totalRecurring) > 0
                        ? `${formatUsd(quote.totalOneTime)}${
                            Number(quote.totalRecurring) > 0
                              ? ` + ${formatUsd(quote.totalRecurring)}/mo`
                              : ""
                          }`
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={
                            canResume
                              ? resumeHref(kind, contactIds, quote.id)
                              : `/offers/${quote.id}`
                          }
                          className="text-xs font-medium text-slate-900 hover:underline"
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
