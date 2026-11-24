import { prisma } from "@/lib/prisma";
import { COMPANY_BRANDS, getCompanyMetrics } from "@/lib/companyMetrics";
import { clientMrrOn } from "@/lib/operations/serviceRecords";
import { freeCashFlow } from "@/lib/companyMetrics/cashFlow";
import { monthRange } from "@/lib/showrunner/month";
import { Missing, Stat, reportChannel, usd } from "./shared";

/**
 * Clients and monthly revenue on one day from the service records' own start and end dates. Past months use
 * this: the live count (getRecordMrr) is driven by today's service tags, so it cannot look back.
 */
async function recordsMrrOn(day: string) {
  const rows = await prisma.serviceRecord.findMany({
    where: { basis: "monthly", brand: { slug: { in: [...COMPANY_BRANDS] } } },
    select: { contactId: true, basis: true, feeAmount: true, startDate: true, endDate: true, contact: { select: { name: true, company: true } } },
  });
  const { clients } = clientMrrOn(rows.map((r) => ({
    contactId: r.contactId, contactName: r.contact.name, company: r.contact.company, basis: r.basis,
    feeAmount: r.feeAmount === null ? null : Number(r.feeAmount),
    startDate: r.startDate.toISOString().slice(0, 10), endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
  })), day);
  return { clients: clients.length, mrrUsd: clients.reduce((n, c) => n + c.mrr, 0) };
}

/** What the month did for the business: leads, offers, clients and MRR at month end, free cash flow once closed. */
export async function BusinessSection({ month }: { month: string }) {
  const range = monthRange(month, new Date());
  const { ctx } = await reportChannel();
  if (!ctx.isPlatformOperator) return <Missing>Business numbers are for Lochside&apos;s own team.</Missing>;
  const [metrics, cash, atEnd] = await Promise.all([
    getCompanyMetrics({ actorUserId: ctx.session.user.id, isPlatformOperator: true, from: range.from, to: range.to }),
    prisma.companyCashFlowMonth.findUnique({ where: { month } }).catch(() => null),
    range.current ? Promise.resolve(null) : recordsMrrOn(range.last),
  ]);
  const t = { ...metrics.total, ...(atEnd ?? {}) };
  const flow = cash ? freeCashFlow({
    month, incomeUsd: Number(cash.incomeUsd), expensesUsd: Number(cash.expensesUsd),
    ownerDrawUsd: Number(cash.ownerDrawUsd), taxSetAsideUsd: Number(cash.taxSetAsideUsd),
  }) : null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="New leads" value={String(t.newLeads)} />
      <Stat label="Offers sent" value={String(t.offersSent)} />
      <Stat label={range.current ? "Clients now" : "Clients at month end"} value={String(t.clients)} />
      <Stat label="Monthly revenue" value={usd(t.mrrUsd)} note="recurring" />
      <div className="col-span-2">
        <Stat
          label="Free cash flow"
          value={flow === null ? "Not closed yet" : usd(flow)}
          note={flow === null ? "Shows once the month's books are closed." : "income − expenses − owner draw − tax set-aside, goal $10,000"}
        />
      </div>
    </div>
  );
}
