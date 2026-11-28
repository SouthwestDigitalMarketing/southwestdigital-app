import { isQuoteFrozen } from "@/lib/quotes/isQuoteFrozen";
import { readAcceptedCopy, readAcceptedCopyLastError } from "@/lib/quotes/acceptedCopy";
import { saveAcceptedCopyAction } from "./actions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaff } from "@/lib/quotes/access";
import { formatUsd, SCENARIO_LABELS } from "@/lib/quotes/format";
import { resumeOfferHref } from "@/lib/quotes/kinds";
import { markQuoteSentAction } from "../actions";
import { updateProposalValidityAction } from "./actions";
import { DuplicateOfferButton } from "../DuplicateOfferButton";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { quoteContactSummaryFromSnapshot } from "@/lib/quotes/clientInfo";
import { proposalValidityDaysFromSnapshot } from "@/lib/quotes/proposalValidity";
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
  const { brand, dataContext } = await requireQuoteStaff();
  const { id } = await params;
  const sp = await searchParams;

  const quote = await prisma.quote.findFirst({
    where: { id, brandId: brand.id },
    include: {
      client: true,
      engagement: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!quote) notFound();

  const frozen = isQuoteFrozen(quote);
  const copy = readAcceptedCopy(quote.engagement?.onboardingData);
  const copyError = readAcceptedCopyLastError(quote.engagement?.onboardingData);
  const hasCopyField = quote.engagement?.onboardingData && typeof quote.engagement.onboardingData === "object"
    && Object.hasOwn(quote.engagement.onboardingData, "acceptedProposalCopy");
  const copyControls = frozen ? (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-800">Accepted proposal</h2>
      <p className="mt-2 text-sm text-slate-600">This offer is frozen. Saved copies are for staff only.</p>
      {copy ? (
        <div className="mt-4 space-y-2 text-sm">
          <p>Saved {copy.savedAt} ({copy.source}). SHA-256: <code className="break-all">{copy.sha256}</code></p>
          <p>Frozen capture of the public proposal page (gzip+base64, verified hash).</p>
          {copy.cssInlined === false ? <p role="status">Styles could not be fully captured (cssInlined: false).</p> : null}
          <div className="flex gap-4">
            <a className="underline" href={`/offers/${quote.id}/accepted-copy`}>View accepted copy</a>
            <a className="underline" href={`/offers/${quote.id}/accepted-copy?download=1`}>Download</a>
          </div>
        </div>
      ) : hasCopyField ? <p className="mt-3 text-sm">A saved copy exists but cannot be verified. Staff review is needed; it will not be overwritten.</p>
        : quote.engagementId ? (
        <form action={saveAcceptedCopyAction} className="mt-4">
          <input type="hidden" name="id" value={quote.id} />
          <p className="mb-3 text-sm text-slate-600">Fetches the live proposal page as staff (no client view is recorded), inlines its styles, and stores a verified frozen copy. Remote media uses labeled placeholders.</p>
          {copyError ? <p role="status" className="mb-3 text-sm text-amber-700">Saved copy not made yet: {copyError.reason}. Use Save accepted copy.</p> : null}
          <button className="ui-action-primary rounded-md px-4 py-2 text-sm" type="submit">Save accepted copy</button>
        </form>
      ) : <p className="mt-3 text-sm">No engagement is attached. Staff review is needed before saving a copy.</p>}
    </section>
  ) : null;

  const snapshot = quote.snapshotJson as QuoteSnapshot;
  const validityDays = proposalValidityDaysFromSnapshot(quote.snapshotJson);
  const expiresLabel = quote.expiresAt
    ? quote.expiresAt.toISOString().slice(0, 10)
    : "no expiry set yet (stamped on publish or send)";
  const contactSummary = quoteContactSummaryFromSnapshot(quote.snapshotJson, quote.client);
  const replaceContacts = frozen
    ? []
    : await withBrandDataTransaction(dataContext, (transaction) =>
        transaction.contact.findMany({
          where: { brandId: brand.id, isActive: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          select: { id: true, name: true, company: true, email: true },
        }),
      );
  if (!snapshot?.package || !snapshot.client) {
    if (frozen) return (
      <div className="mx-auto max-w-4xl space-y-6 p-8">
        <Link href="/offers" className="text-sm underline">← All Offers</Link>
        <h1 className="text-2xl font-semibold">{quote.client.name} — accepted offer</h1>
        {copyControls}
      </div>
    );
    redirect(
      resumeOfferHref({
        id: quote.id,
        kind: quote.kind,
        snapshot:
          quote.snapshotJson && typeof quote.snapshotJson === "object"
            ? (quote.snapshotJson as { contactIds?: string | string[]; kind?: string })
            : null,
      }),
    );
  }

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

        {copyControls}

        {banner && (
          <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${banner.tone}`}>
            {banner.msg}
          </div>
        )}

        {!frozen && (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-800">Proposal settings</h2>
            <p className="mt-1 text-sm text-slate-500">
              Public link expires {expiresLabel}. New publishes and sends use the validity below.
            </p>
            <form action={updateProposalValidityAction} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={quote.id} />
              <label className="text-sm text-slate-600">
                Valid for (days)
                <input
                  type="number"
                  name="validityDays"
                  min={1}
                  max={365}
                  defaultValue={validityDays}
                  className="ml-2 w-24 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800"
                />
              </label>
              <button
                type="submit"
                className="rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Save validity
              </button>
            </form>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-800">Replace this proposal</h3>
              <p className="mt-1 text-sm text-slate-500">
                Creates a new draft linked to this proposal. When the new draft is published or
                sent, this proposal expires automatically. No email is sent.
              </p>
              <div className="mt-2">
                <DuplicateOfferButton
                  offerId={quote.id}
                  currentContact={{
                    contactId: contactSummary.contactId,
                    name: contactSummary.name,
                    company: contactSummary.company,
                    email: contactSummary.email || null,
                  }}
                  contacts={replaceContacts}
                  archived={quote.status === "archived"}
                  menuItem
                  replaceMode
                />
              </div>
            </div>
            <p className="mt-4 text-sm">
              <Link href="/offers/review" className="underline">
                Review old proposal links
              </Link>
            </p>
          </section>
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
          <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
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
              <tr className="border-b border-slate-50 text-left text-sm font-semibold normal-case text-slate-700">
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
          {!frozen && quote.status === "draft" && (
            <form action={markQuoteSentAction}>
              <input type="hidden" name="id" value={quote.id} />
              <button
                type="submit"
                className="ui-action-primary rounded-md px-4 py-2 text-sm font-medium transition"
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
