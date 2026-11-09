import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffBrand } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { LeadManagement } from "../LeadManagement";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ archived?: string; updated?: string }>;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children || "Not set"}</dd>
    </div>
  );
}

export default async function LeadDetailPage({ params, searchParams }: PageProps) {
  const { brand, dataContext } = await requireStaffBrand();
  const { id } = await params;
  const query = await searchParams;
  const lead = await withBrandDataTransaction(dataContext, (transaction) =>
    transaction.meetingLead.findFirst({
      where: { id, brandId: brand.id },
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        kind: true,
        bookkeepingCategory: true,
        expectedServices: true,
        notes: true,
        amount: true,
        amountKind: true,
        offerType: true,
        valueBasis: true,
        firstPaymentReceivedAt: true,
        serviceAgreementSignedAt: true,
        nextAction: true,
        nextDue: true,
        pipeId: true,
        isActive: true,
        pipelineItems: {
          where: { isActive: true, pipeline: { isActive: true }, stage: { isActive: true } },
          select: {
            baseValueUsd: true,
            stage: { select: { name: true } },
            pipeline: { select: { key: true, name: true } },
          },
        },
      },
    }),
  );

  if (!lead) notFound();
  const showArchived = !lead.isActive;

  const linkedContacts = await withBrandDataTransaction(dataContext, async (transaction) => {
    const links = await transaction.leadContact.findMany({
      where: { brandId: brand.id, leadId: lead.id },
      orderBy: { createdAt: "asc" },
      select: { contactId: true },
    });
    const contactIds = [...new Set(links.map((link) => link.contactId))];
    if (contactIds.length === 0) return [];
    return transaction.contact.findMany({
      where: { brandId: brand.id, id: { in: contactIds }, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        company: true,
        tagLinks: {
          where: { tag: { isActive: true } },
          select: { tag: { select: { id: true, label: true, kind: true } } },
        },
      },
    });
  });

  return (
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-8">
      <div>
        <Link href={showArchived ? "/pipeline?view=archived" : "/dashboard"} className="text-sm text-slate-500 hover:underline">← {showArchived ? "Archived leads" : "Dashboard"}</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Lead details</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">{lead.name}</h1>
        <p className="mt-1 text-sm text-slate-600">{lead.company || "No company listed"}</p>
      </div>

      {query.updated === "1" ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Lead details saved.</p> : null}
      <LeadManagement lead={{
        id: lead.id,
        name: lead.name,
        company: lead.company,
        email: lead.email,
        expectedServices: lead.expectedServices,
        notes: lead.notes,
        nextAction: lead.nextAction,
        nextDue: lead.nextDue,
        amount: lead.amount == null ? null : Number(lead.amount),
        amountKind: lead.amountKind,
        pipelineValue: Number(lead.pipelineItems[0]?.baseValueUsd ?? 0),
        offerType: lead.offerType,
        valueBasis: lead.valueBasis,
        firstPaymentReceivedAt: lead.firstPaymentReceivedAt?.toISOString() ?? null,
        serviceAgreementSignedAt: lead.serviceAgreementSignedAt?.toISOString() ?? null,
        pipeId: lead.pipeId,
        isActive: lead.isActive,
      }} />

      <section className="rounded-xl border border-slate-200 bg-white px-4 shadow-sm sm:px-5">
        <dl>
          <Detail label="Email">{lead.email ? <a className="break-all text-brandnavy hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : null}</Detail>
          <Detail label="Status">{lead.kind === "PROSPECT" ? "Prospect" : "Lead"}</Detail>
          <Detail label="Offer / invoice amount">
            {lead.amount != null
              ? `${formatMoney(Number(lead.amount))}${lead.amountKind ? ` · ${lead.amountKind}` : ""}`
              : "Not set"}
          </Detail>
          <Detail label="Forecast value">
            {lead.pipelineItems.length ? `${formatMoney(Number(lead.pipelineItems[0].baseValueUsd))}${lead.valueBasis === "monthly" ? " / month" : lead.valueBasis === "one_time" ? " one-time" : ""}` : null}
          </Detail>
          <Detail label="Service type">{{ bookkeeping: "Monthly bookkeeping", onsite: "On-site work", training: "Training / consult" }[lead.offerType ?? ""] ?? lead.offerType}</Detail>
          <Detail label="Value basis">{{ monthly: "Monthly", one_time: "One-time", unpriced: "Unpriced" }[lead.valueBasis ?? ""] ?? lead.valueBasis}</Detail>
          <Detail label="Initial payment received">{lead.firstPaymentReceivedAt?.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</Detail>
          <Detail label="Service agreement signed">{lead.serviceAgreementSignedAt?.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</Detail>
          <Detail label="Expected services">{lead.expectedServices}</Detail>
          <Detail label="Next action">{lead.nextAction}</Detail>
          <Detail label="Next due">{lead.nextDue}</Detail>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Pipeline stages</h2>
        {lead.pipelineItems.length > 0 ? (
          <ul className="mt-2 divide-y divide-slate-100">
            {lead.pipelineItems.map((item, index) => (
              <li key={`${item.pipeline.key}-${index}`} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{item.pipeline.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{item.stage.name}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                  {Number(item.baseValueUsd) > 0 ? formatMoney(Number(item.baseValueUsd)) : "Value not set"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">This lead is not in an active pipeline stage.</p>
        )}
      </section>

      {linkedContacts.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Linked contacts</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {linkedContacts.map((contact) => (
              <li key={contact.id}>
                <Link href={`/contacts/${encodeURIComponent(contact.id)}`} className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm hover:text-brandnavy">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{contact.name}</span>
                    {contact.company ? <span className="block truncate text-xs text-slate-500">{contact.company}</span> : null}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Tags</h2>
        {linkedContacts.length > 0 ? (
          <ul className="mt-2 space-y-3">
            {linkedContacts.map((contact) => (
              <li key={contact.id}>
                <Link href={`/contacts/${encodeURIComponent(contact.id)}`} className="text-sm font-medium hover:text-brandnavy hover:underline">{contact.name}</Link>
                {contact.tagLinks.length > 0 ? (
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {contact.tagLinks.map((link) => (
                      <span key={link.tag.id} title={link.tag.kind} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{link.tag.label}</span>
                    ))}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">No tags applied.</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No linked contact, so no tags to show.</p>
        )}
      </section>

      {lead.notes ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{lead.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
