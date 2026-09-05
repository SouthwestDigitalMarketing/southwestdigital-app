import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resolvePublicBrand } from "@/lib/brands/resolve";
import { readAcceptedSelection } from "@/lib/engagements/acceptedPayment";
import AgreementTextView from "@/app/(app)/offers/builder/AgreementTextView";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatUsd(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function ProposalReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hostname = (await headers()).get("x-hostname");
  const brand = await resolvePublicBrand(hostname);
  if (!brand) notFound();

  const quote = await prisma.quote.findFirst({
    where: { brandId: brand.id, publicToken: token, publishedAt: { not: null } },
    select: {
      offerCode: true,
      client: { select: { name: true, company: true } },
      engagement: {
        select: {
          clientName: true,
          status: true,
          onboardingFeeStatus: true,
          onboardingData: true,
          agreementText: true,
          agreementTextHash: true,
          signerName: true,
          signerTitle: true,
          billingContactEmail: true,
          signedAt: true,
          agreementManagerStatus: true,
          isTestProposal: true,
        },
      },
    },
  });
  if (!quote?.engagement) notFound();
  if (!quote.engagement.signedAt || !quote.engagement.agreementText) redirect(`/proposal/${token}`);

  const onboardingData = isRecord(quote.engagement.onboardingData) ? quote.engagement.onboardingData : {};
  const { bookkeeping: checkout, hourly } = readAcceptedSelection(onboardingData);
  const acceptance = isRecord(onboardingData.proposalAcceptance) ? onboardingData.proposalAcceptance : {};
  const payment = isRecord(acceptance.payment) ? acceptance.payment : {};
  const paid = quote.engagement.onboardingFeeStatus === "PAID" || payment.status === "paid";
  const amountPaid = typeof payment.amount === "number"
    ? payment.amount
    : null;
  const paidAt = typeof payment.paidAt === "string" ? new Date(payment.paidAt) : null;
  const paymentReference = typeof payment.reference === "string" ? payment.reference : null;
  const receiptUrl = typeof payment.receiptUrl === "string" ? payment.receiptUrl : null;
  const clientName = quote.engagement.clientName || quote.client.company || quote.client.name;

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,var(--surface-subtle),var(--theme-white))] px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {quote.engagement.isTestProposal ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-950">
            Test proposal record — no client engagement should be started from this transaction.
          </div>
        ) : null}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Signed proposal record</p>
              <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{clientName}</h1>
              <p className="mt-2 font-mono text-xs text-slate-500">Offer {quote.offerCode}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {paid ? "Signed & paid" : "Signed · payment pending"}
            </span>
          </div>

          <dl className="mt-8 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2">
            <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Service</dt><dd className="mt-1 break-words text-lg font-semibold">{hourly?.catalogItemLabel ?? checkout?.tierLabel ?? "Recorded in agreement"}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Signed</dt><dd className="mt-1 text-lg font-semibold">{quote.engagement.signedAt.toLocaleString("en-US")}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{hourly ? "Accepted scope" : "Ongoing services"}</dt><dd className="mt-1 text-lg font-semibold">{hourly ? `${hourly.quantity} hours · ${formatUsd(hourly.total)} total` : checkout ? `${formatUsd(checkout.recurringMonthlyTotal)}/month` : "See agreement"}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Paid now</dt><dd className="mt-1 text-lg font-semibold">{amountPaid === null ? paid ? "Amount not recorded" : "Pending" : formatUsd(amountPaid)}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Signed by</dt><dd className="mt-1 font-semibold">{quote.engagement.signerName}{quote.engagement.signerTitle ? ` · ${quote.engagement.signerTitle}` : ""}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment confirmation</dt><dd className="mt-1 font-semibold">{paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt.toLocaleString("en-US") : paid ? "Confirmed" : "Not yet confirmed"}</dd></div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/api/proposal/${token}/signed-document`} className="ui-action-primary inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold">
              <Download className="h-4 w-4" /> Download signed PDF
            </Link>
            {receiptUrl ? (
              <a href={receiptUrl} target="_blank" rel="noreferrer noopener" className="ui-action-secondary inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold">
                <ExternalLink className="h-4 w-4" /> View payment receipt
              </a>
            ) : null}
          </div>
          {paymentReference ? <p className="mt-4 break-all text-xs text-slate-500">Payment reference: {paymentReference}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold">Signed agreement</h2>
          <p className="mt-1 text-sm text-slate-500">This is the agreement text frozen at signature time.</p>
          <div className="mt-6 border-t border-slate-200 pt-6">
            <AgreementTextView text={quote.engagement.agreementText} />
          </div>
          <p className="mt-6 break-all rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-500">
            SHA-256: {quote.engagement.agreementTextHash ?? "Not recorded"}
          </p>
        </section>
      </div>
    </main>
  );
}
