import Link from "next/link";
import { Copy, Eye, FlaskConical } from "lucide-react";
import { BrandStatus, type Prisma } from "@prisma/client";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { prisma } from "@/lib/prisma";
import { formatUsd } from "@/lib/quotes/format";
import { isOfferKindKey, OFFER_KINDS, resumeOfferHref } from "@/lib/quotes/kinds";
import { quoteContactSummaryFromSnapshot } from "@/lib/quotes/clientInfo";
import {
  deriveLifecycleStage,
  isStale,
  nextStaffAction,
  type NextActionKey,
} from "@/lib/quotes/lifecycle";
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
import { SendOfferEmailButton } from "./SendOfferEmailButton";
import { OfferEditButton } from "./OfferEditButton";

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

function formatLastSentAge(date: Date | null) {
  if (!date) return "Not sent";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "Today";
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function daysStaleFrom(date: Date | null) {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
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
    <th className="px-5 py-2 text-base font-semibold normal-case text-slate-700">
      <Link href={`/offers?${query.toString()}`} className="inline-flex items-center gap-1 hover:text-slate-950">
        {label}
        {currentSort === sortKey ? <span aria-hidden="true">{currentOrder === "asc" ? "↑" : "↓"}</span> : null}
      </Link>
    </th>
  );
}

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  const { brand, isPlatformOperator } = await requireQuoteStaff();
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

  const [listed, contacts, contact, tags, clients, platformBrands] = await Promise.all([
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
        engagement: {
          select: { signedAt: true, onboardingFeeStatus: true },
        },
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
    prisma.contactTag.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, kind: true },
    }),
    prisma.ticketClient.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    isPlatformOperator
      ? prisma.brand.findMany({
          where: { status: BrandStatus.ACTIVE },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const contactCreationOptions = {
    tags,
    clients: clients.map((client) => ({
      id: client.id,
      label: client.name?.trim() || client.code,
    })),
    brands: platformBrands.map((item) => ({ id: item.id, label: item.name })),
  };

  const followUpItems = listed
    .map((quote) => {
      const stage = deriveLifecycleStage({
        status: quote.status,
        publishedAt: quote.publishedAt,
        firstSentAt: quote.firstSentAt,
        firstViewedAt: quote.firstViewedAt,
        engagement: quote.engagement,
      });
      const action = nextStaffAction({
        stage,
        lastActivityAt: quote.lastActivityAt,
        lastFollowUpAt: quote.lastFollowUpAt,
      });
      if (
        action !== "SEND_READY" &&
        action !== "NUDGE_UNVIEWED" &&
        action !== "NUDGE_UNSIGNED" &&
        action !== "NUDGE_UNPAID"
      ) {
        return null;
      }
      const summary = quoteContactSummaryFromSnapshot(quote.snapshotJson, quote.client);
      const clientLabel =
        summary.name ||
        summary.company ||
        quote.client.name ||
        `Offer …${quote.offerCode.slice(-4)}`;
      // For SEND_READY the "quiet" timer is measured against publishedAt
      // (how long has it sat unshared), not lastActivityAt.
      const referenceDate =
        action === "SEND_READY" ? quote.publishedAt : quote.lastActivityAt;
      const daysStale = daysStaleFrom(referenceDate);
      const stageHint =
        action === "SEND_READY"
          ? "Published, not sent yet"
          : action === "NUDGE_UNVIEWED"
            ? "Not opened yet"
            : action === "NUDGE_UNSIGNED"
              ? "Viewed, no signature"
              : "Signed, no payment";
      return { id: quote.id, clientLabel, daysStale, stageHint, action };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.daysStale - a.daysStale);

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

      {followUpItems.length > 0 ? (
        <section className="-mx-8 px-8 pb-6 pt-8">
          <h2 className="text-lg font-semibold text-slate-700">
            Your move
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-sm font-semibold text-blue-800">
              {followUpItems.length}
            </span>
          </h2>
          <p className="mt-1 text-base text-slate-500">
            Proposals waiting on you — either to send for the first time, or to nudge a client who&apos;s gone quiet.
          </p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {followUpItems.slice(0, 6).map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{item.clientLabel}</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {item.stageHint} ·{" "}
                      {item.action === "SEND_READY"
                        ? item.daysStale === 0
                          ? "just published"
                          : `${item.daysStale} ${item.daysStale === 1 ? "day" : "days"} since publish`
                        : item.daysStale === 0
                          ? "today"
                          : `${item.daysStale} ${item.daysStale === 1 ? "day" : "days"} quiet`}
                    </p>
                  </div>
                  <Link
                    href={`#offer-row-${item.id}`}
                    className="ui-action-primary inline-flex h-8 items-center rounded-full border px-3 text-sm font-semibold transition"
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {followUpItems.length > 6 ? (
            <p className="mt-3 text-sm text-slate-500">
              …and {followUpItems.length - 6} more below in the Manage offers table.
            </p>
          ) : null}
        </section>
      ) : null}

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
                <th className="px-5 py-2 text-base font-semibold normal-case text-slate-700">Offer ID</th>
                <th className="px-5 py-2 text-base font-semibold normal-case text-slate-700">Type</th>
                <SortableHeader label="Contact" sortKey="contact" currentSort={sortKey} currentOrder={sortOrder} params={params} />
                <SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentOrder={sortOrder} params={params} />
                <SortableHeader label="MRR" sortKey="mrr" currentSort={sortKey} currentOrder={sortOrder} params={params} />
                <SortableHeader label="Lump" sortKey="lump" currentSort={sortKey} currentOrder={sortOrder} params={params} />
                <SortableHeader label="Last sent" sortKey="lastSent" currentSort={sortKey} currentOrder={sortOrder} params={params} />
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
                        isFreshDuplicate?: boolean;
                        isTestProposal?: boolean;
                        duplicatedFromOfferCode?: string;
                        pricing?: {
                          maintain?: { monthly?: number; totalOneTime?: number };
                        };
                      })
                    : {};
                const kind = snapshot.kind ?? quote.kind;
                const itemBucket = bucketForStatus(quote.status);
                const isDraft = itemBucket === "draft";
                const editHref = resumeOfferHref({ id: quote.id, kind, snapshot });
                const publishedProposalHref = quote.publicToken
                  ? `/proposal/${quote.publicToken}?staffPreview=1`
                  : null;
                const lifecycleStage = deriveLifecycleStage({
                  status: quote.status,
                  publishedAt: quote.publishedAt,
                  firstSentAt: quote.firstSentAt,
                  firstViewedAt: quote.firstViewedAt,
                  engagement: quote.engagement,
                });
                const nextAction: NextActionKey = nextStaffAction({
                  stage: lifecycleStage,
                  lastActivityAt: quote.lastActivityAt,
                  lastFollowUpAt: quote.lastFollowUpAt,
                });
                const rowIsStale = isStale({
                  stage: lifecycleStage,
                  lastActivityAt: quote.lastActivityAt,
                  lastFollowUpAt: quote.lastFollowUpAt,
                });
                const sendPrimaryLabel =
                  nextAction === "SEND_READY"
                    ? "Send this proposal — it's published but not delivered yet"
                    : nextAction === "NUDGE_UNVIEWED"
                      ? "Nudge client — proposal not opened yet"
                      : nextAction === "NUDGE_UNSIGNED"
                        ? "Follow up — viewed but not signed"
                        : nextAction === "NUDGE_UNPAID"
                          ? "Send payment reminder"
                          : undefined;
                const sendIsPrimary =
                  nextAction === "SEND_READY" ||
                  nextAction === "NUDGE_UNVIEWED" ||
                  nextAction === "NUDGE_UNSIGNED" ||
                  nextAction === "NUDGE_UNPAID";
                const editIsPrimary = nextAction === "EDIT_DRAFT";
                const editHasClientProgress =
                  lifecycleStage === "VIEWED" ||
                  lifecycleStage === "SIGNED" ||
                  lifecycleStage === "PAID";
                const followUpKind =
                  nextAction === "NUDGE_UNVIEWED"
                    ? ("unviewed" as const)
                    : nextAction === "NUDGE_UNSIGNED"
                      ? ("unsigned" as const)
                      : nextAction === "NUDGE_UNPAID"
                        ? ("unpaid" as const)
                        : undefined;
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
                const isTestProposal = snapshot.isTestProposal === true;
                const duplicatedFromOfferCode =
                  typeof snapshot.duplicatedFromOfferCode === "string"
                    ? snapshot.duplicatedFromOfferCode
                    : null;
                const duplicateTooltip = duplicatedFromOfferCode
                  ? `Duplicated from ...${duplicatedFromOfferCode.slice(-4)}`
                  : "Duplicated from another offer";
                return (
                  <tr
                    id={`offer-row-${quote.id}`}
                    key={quote.id}
                    className={`hover:bg-slate-50 ${quote.id === highlightId ? "offer-row-highlight" : ""}`}
                  >
                    <td className="px-5 py-4 text-base text-slate-500">
                      {quote.id === highlightId && (isDuplicate || isTestProposal) ? (
                        <DuplicateOfferFocus offerId={quote.id} />
                      ) : null}
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono"
                          title={quote.offerCode}
                          aria-label={`Offer ID ${quote.offerCode}`}
                        >
                          ...{quote.offerCode.slice(-4)}
                        </span>
                        {isTestProposal ? (
                          <span
                            title={`$1 test proposal: ${quote.id}`}
                            aria-label={`$1 test proposal ${quote.id}`}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-900"
                          >
                            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        ) : null}
                        {isDuplicate ? (
                          <span
                            title={duplicateTooltip}
                            aria-label={duplicateTooltip}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-900"
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-base">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-600">
                        {OFFER_KINDS.find((k) => k.key === kind)?.name ?? kind}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <OfferContactCell
                        offerId={quote.id}
                        currentContact={currentContact}
                        contacts={contacts}
                        creationOptions={contactCreationOptions}
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
                    <td
                      className={
                        rowIsStale
                          ? "px-5 py-4 font-semibold text-amber-800"
                          : "px-5 py-4 text-slate-500"
                      }
                      title={rowIsStale ? "This proposal has gone quiet — consider a follow-up." : undefined}
                    >
                      {formatLastSentAge(quote.lastSentAt ?? quote.sentAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {!isDraft && publishedProposalHref ? (
                          <Link
                            href={publishedProposalHref}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="View published proposal (opens in new tab)"
                            title="View published proposal (opens in new tab)"
                            className="ui-action-secondary inline-flex h-9 w-9 items-center justify-center rounded-full border transition"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        ) : !isDraft ? (
                          <Link
                            href={`/offers/${quote.id}`}
                            className="ui-action-secondary inline-flex h-9 items-center justify-center rounded-full border px-3 text-base font-semibold leading-none transition"
                          >
                            Details
                          </Link>
                        ) : null}
                        <OfferEditButton
                          href={editHref}
                          offerId={quote.id}
                          viewed={editHasClientProgress && Boolean(quote.firstViewedAt)}
                          signed={editHasClientProgress && Boolean(quote.engagement?.signedAt)}
                          paid={editHasClientProgress && quote.engagement?.onboardingFeeStatus === "PAID"}
                          primary={editIsPrimary}
                        />
                        <SendOfferEmailButton
                          offerId={quote.id}
                          hasBeenSent={Boolean(quote.lastSentAt ?? quote.sentAt)}
                          disabled={itemBucket === "draft" && lifecycleStage === "DRAFT"}
                          primary={sendIsPrimary}
                          primaryLabel={sendPrimaryLabel}
                          followUpKind={followUpKind}
                        />
                        <OfferStatusButtons offerId={quote.id} bucket={itemBucket}>
                          <DuplicateOfferButton
                            offerId={quote.id}
                            currentContact={currentContact}
                            contacts={contacts}
                            archived={archived}
                          />
                        </OfferStatusButtons>
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
