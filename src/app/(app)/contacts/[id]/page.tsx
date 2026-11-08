import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { ensureDefaultContactTags } from "@/lib/contacts/seed";
import { formatPhone } from "@/lib/phone";
import { ContactEditor } from "./ContactEditor";
import { ContactActions } from "../ContactActions";
import { BrandStatus } from "@prisma/client";
import { ContactTagsEditor } from "../ContactTagsEditor";
import { BrandAssignment, ClientAssignment } from "../AssignmentToggles";
import { matchArCustomerToContact } from "@/lib/ar/matchArCustomers";

type PageProps = { params: Promise<{ id: string }> };

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatSnapshotTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(value);
}

function formatTenure(value: Date, now: Date): string {
  const months = Math.max(
    0,
    (now.getUTCFullYear() - value.getUTCFullYear()) * 12 +
      now.getUTCMonth() -
      value.getUTCMonth(),
  );
  if (months === 0) return "Less than a month";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${months} ${months === 1 ? "month" : "months"}`;
  if (remainingMonths === 0) return `${years} ${years === 1 ? "year" : "years"}`;
  return `${years}y ${remainingMonths}m`;
}

type InvoicePayment = {
  id: string;
  date: string | null;
  totalAmount: number;
  appliedAmount: number;
};

function readPayments(value: unknown): InvoicePayment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const payment = item as Record<string, unknown>;
    if (typeof payment.id !== "string") return [];
    return [{
      id: payment.id,
      date: typeof payment.date === "string" ? payment.date : null,
      totalAmount: Number(payment.totalAmount) || 0,
      appliedAmount: Number(payment.appliedAmount) || 0,
    }];
  });
}

export default async function ContactDetailPage({ params }: PageProps) {
  const { brand, isPlatformOperator, dataContext } = await requireStaffBrand();
  await ensureDefaultContactTags(brand.id);
  const { id } = await params;

  const [rawContact, tags, clients, platformBrands, arSnapshotRows] = await Promise.all([
    withBrandDataTransaction(dataContext, (transaction) =>
      transaction.contact.findFirst({
        where: { id, brandId: brand.id },
        include: {
          tagLinks: { select: { tagId: true } },
          clientLinks: {
            select: {
              clientId: true,
              client: { select: { createdAt: true } },
            },
          },
          brandLinks: { select: { relatedBrandId: true } },
          leadLinks: {
            select: {
              lead: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ),
    prisma.contactTag.findMany({
      where: { brandId: brand.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, kind: true, _count: { select: { contacts: true } } },
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
    withBrandDataTransaction(dataContext, (transaction) =>
      transaction.customerArSnapshot.findMany({
        where: { brandId: brand.id },
        select: {
          id: true,
          customerName: true,
          invoiceRef: true,
          qboInvoiceId: true,
          qboCustomerId: true,
          qboDocNumber: true,
          txnDate: true,
          dueDate: true,
          totalAmount: true,
          openBalance: true,
          status: true,
          paymentHistory: true,
          syncedAt: true,
        },
        orderBy: [{ txnDate: "desc" }, { customerName: "asc" }],
      }),
    ),
  ]);

  const contact = rawContact;

  if (!contact) notFound();

  const assigned = new Set(contact.tagLinks.map((link: { tagId: string }) => link.tagId));
  const pipelinePlacements: Array<{ pipeline: string; stage: string }> = [];
  const contactMatch = [{ id: contact.id, name: contact.name, company: contact.company }];
  const invoices = arSnapshotRows
    .filter(
      (row) =>
        matchArCustomerToContact(row.customerName, contactMatch) === contact.id,
    )
    .map((row) => ({
      ...row,
      openBalance: Number(row.openBalance),
      totalAmount: row.totalAmount == null ? null : Number(row.totalAmount),
      payments: readPayments(row.paymentHistory),
    }));
  const openInvoices = invoices.filter((row) => row.openBalance > 0 && row.status !== "VOIDED");
  const totalOpen = openInvoices.reduce((sum, row) => sum + row.openBalance, 0);
  const invoiceHistorySynced = invoices.some((row) => Boolean(row.qboInvoiceId));
  const lifetimePaid = invoiceHistorySynced
    ? invoices.reduce((sum, row) => sum + row.payments.reduce((paid, payment) => paid + payment.appliedAmount, 0), 0)
    : null;
  const latestSnapshotAt = arSnapshotRows.reduce<Date | null>(
    (latest, row) => (!latest || row.syncedAt > latest ? row.syncedAt : latest),
    null,
  );
  const clientSince = contact.clientLinks
    .map((link: { client: { createdAt: Date } }) => link.client.createdAt)
    .sort((left: Date, right: Date) => left.getTime() - right.getTime())[0] ?? null;
  const now = new Date();

  return (
    <div className="space-y-5 p-4 sm:space-y-8 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/contacts" className="text-xs text-slate-400 hover:underline">
              ← All contacts
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">{contact.name}</h1>
            <div className="mt-2 space-y-1 text-sm text-slate-500">
              <p>{contact.company || "No company listed"}</p>
              {contact.email && <p className="break-all">{contact.email}</p>}
              {contact.phoneE164 && <p>{formatPhone(contact.phoneE164)}</p>}
              {!contact.isActive && <p className="font-medium text-amber-700">Archived</p>}
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm">
          <div className="border-b border-white/10 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Client stats
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            <div className="border-b border-r border-white/10 p-4 sm:border-b-0 sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">MRR</p>
              <p className="mt-2 whitespace-nowrap text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                {contact.mrrUsd == null ? "—" : formatMoney(Number(contact.mrrUsd))}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {contact.mrrUsd == null ? "Not set" : "per month"}
              </p>
            </div>
            <div className="border-b border-white/10 p-4 sm:border-b-0 sm:border-r sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Open balance</p>
              <p className="mt-2 whitespace-nowrap text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                {latestSnapshotAt ? formatMoney(totalOpen) : "—"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {latestSnapshotAt
                  ? `${openInvoices.length} open ${openInvoices.length === 1 ? "invoice" : "invoices"} · snapshot`
                  : "No snapshot"}
              </p>
            </div>
            <div className="border-r border-white/10 p-4 sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Client tenure</p>
              <p className="mt-2 whitespace-nowrap text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                {clientSince ? formatTenure(clientSince, now) : "—"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {clientSince ? `Since ${formatDate(clientSince)}` : "Start date not linked"}
              </p>
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Lifetime paid</p>
              <p className="mt-2 whitespace-nowrap text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                {lifetimePaid == null ? "—" : formatMoney(lifetimePaid)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {invoiceHistorySynced ? "Applied QuickBooks payments" : "Payment history not synced"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Invoice history</h2>
              <p className="mt-1 text-sm text-slate-500">Invoices and applied payments from QuickBooks</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {latestSnapshotAt
              ? `Snapshot pulled ${formatSnapshotTime(latestSnapshotAt)} · not live`
              : "No QuickBooks invoice snapshot is available yet."}
          </p>
          {invoices.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-900">
                      {invoice.qboDocNumber || invoice.invoiceRef || "Invoice"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Issued {invoice.txnDate ? formatDate(invoice.txnDate) : "date not listed"}
                    </p>
                    {invoice.payments.length > 0 ? (
                      <p className="mt-1 text-sm text-emerald-700">
                        Paid {invoice.payments.map((payment) => payment.date ? formatDate(new Date(`${payment.date}T00:00:00Z`)) : "date not listed").join(", ")}
                      </p>
                    ) : invoice.dueDate ? (
                      <p className="mt-1 text-sm text-slate-500">Due {formatDate(invoice.dueDate)}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-slate-900">
                      {formatMoney(invoice.totalAmount ?? invoice.openBalance)}
                    </p>
                    <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${invoice.qboInvoiceId && invoice.status === "PAID" ? "text-emerald-700" : invoice.qboInvoiceId && invoice.status === "PARTIAL" ? "text-amber-700" : invoice.qboInvoiceId && invoice.status === "VOIDED" ? "text-slate-500" : invoice.qboInvoiceId && invoice.openBalance > 0 && invoice.dueDate && invoice.dueDate < new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`) ? "text-rose-700" : invoice.qboInvoiceId ? "text-slate-600" : "text-slate-500"}`}>
                      {!invoice.qboInvoiceId ? "Snapshot" : invoice.status === "PAID" ? "Paid" : invoice.status === "PARTIAL" ? `Partial · ${formatMoney(invoice.openBalance)} due` : invoice.status === "VOIDED" ? "Voided" : invoice.openBalance > 0 && invoice.dueDate && invoice.dueDate < new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`) ? `Past due · ${formatMoney(invoice.openBalance)}` : invoice.openBalance > 0 ? `Open · ${formatMoney(invoice.openBalance)} due` : "Zero balance"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : latestSnapshotAt ? (
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No open invoices in this snapshot.
            </p>
          ) : (
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No invoice snapshot is available, so the current balance is unknown.
            </p>
          )}
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Invoice status and payment dates reflect the last QuickBooks sync.
          </p>
        </section>

        <div className="flex justify-end">
          <ContactActions contactId={contact.id} isActive={contact.isActive} variant="primary" />
        </div>

        <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-4 text-base font-semibold text-slate-900 sm:px-6">
            More details
            <span className="mt-1 block text-sm font-normal text-slate-500">
              Contact info, clients, brands, tags, and admin settings
            </span>
          </summary>
          <div className="space-y-5 border-t border-slate-100 p-4 sm:space-y-6 sm:p-6">
            <section>
              <h2 className="text-base font-semibold text-slate-800">Clients</h2>
              <p className="mt-1 text-sm text-slate-500">
                Link this contact to the client companies they work with.
              </p>
              <div className="mt-3">
                <ClientAssignment
                  contactId={contact.id}
                  clients={clients.map((client) => ({
                    id: client.id,
                    label: client.name?.trim() || client.code,
                  }))}
                  assignedIds={contact.clientLinks.map((link: { clientId: string }) => link.clientId)}
                />
              </div>
            </section>

            {isPlatformOperator && (
              <section>
                <h2 className="text-base font-semibold text-slate-800">Brands</h2>
                <p className="mt-1 text-sm text-slate-500">
                  App tenants this person is tied to.
                </p>
                <div className="mt-3">
                  <BrandAssignment
                    contactId={contact.id}
                    brands={platformBrands.map((item) => ({ id: item.id, label: item.name }))}
                    assignedIds={contact.brandLinks.map((link: { relatedBrandId: string }) => link.relatedBrandId)}
                  />
                </div>
              </section>
            )}

            <section>
              <h2 className="text-base font-semibold text-slate-800">Tags</h2>
              <div className="mt-3">
                <ContactTagsEditor
                  contactId={contact.id}
                  tags={tags.map((tag) => ({
                    id: tag.id,
                    label: tag.label,
                    kind: tag.kind,
                    assigned: assigned.has(tag.id),
                    usageCount: tag._count.contacts,
                  }))}
                />
              </div>
            </section>

            {pipelinePlacements.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-slate-800">Pipelines</h2>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {pipelinePlacements.map((item) => (
                    <li key={`${item.pipeline}-${item.stage}`}>
                      {item.pipeline}
                      <span className="text-slate-400"> · {item.stage}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <ContactEditor
              contact={{
                id: contact.id,
                firstName: contact.firstName?.trim() || contact.name.split(" ")[0] || "",
                lastName:
                  contact.lastName?.trim() || contact.name.split(" ").slice(1).join(" ").trim() || "",
                email: contact.email ?? "",
                phone: contact.phoneE164 ?? "",
                company: contact.company ?? "",
                roleTitle: contact.roleTitle ?? "",
                mrrUsd: contact.mrrUsd?.toString() ?? "",
                notes: contact.notes ?? "",
                isActive: contact.isActive,
              }}
            />
            <section>
              <h2 className="text-base font-semibold text-slate-800">Account actions</h2>
              <div className="mt-3">
                <ContactActions contactId={contact.id} isActive={contact.isActive} variant="secondary" />
              </div>
            </section>
          </div>
        </details>
    </div>
  );
}
