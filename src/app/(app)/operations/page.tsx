import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import {
  CADENCES,
  PLAYBOOK,
  dutiesDueOn,
  upcomingThisMonth,
  type Duty,
} from "@/lib/operations/playbook";

export default async function OperationsPage() {
  const { brand } = await requireStaffBrand();
  const now = new Date();

  const clients = await prisma.ticketClient.findMany({
    where: { brandId: brand.id, isActive: true },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });

  const dueToday = dutiesDueOn(now);
  const clientDutiesToday = dueToday.filter((d) => d.scope === "client");
  const firmDutiesToday = dueToday.filter((d) => d.scope === "firm");
  const upcoming = upcomingThisMonth(now);
  const todayLabel = now.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">Operations</h1>
      <p className="mt-1 text-sm text-slate-500">{todayLabel}</p>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Preview: tracking is not connected yet.</p>
        <p className="mt-1">
          This shows the playbook and what is due. A duty turns green only when an agent posts
          evidence for it, and that is the next step. Nothing here is marked done until then.
        </p>
      </div>

      <Section title="Today" count={dueToday.length}>
        {dueToday.length === 0 ? (
          <Empty>Nothing scheduled today.</Empty>
        ) : (
          <>
            {firmDutiesToday.map((duty) => (
              <DutyRow key={duty.id} duty={duty} detail="Firm-wide" />
            ))}
            {clientDutiesToday.map((duty) => (
              <DutyRow
                key={duty.id}
                duty={duty}
                detail={`${clients.length} client${clients.length === 1 ? "" : "s"}`}
              />
            ))}
          </>
        )}
      </Section>

      <Section title="Clients" count={clients.length}>
        {clients.length === 0 ? (
          <Empty>No active clients for this brand.</Empty>
        ) : (
          clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                <span className="truncate font-medium text-slate-900">{client.name}</span>
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {clientDutiesToday.length} due today · not connected
              </span>
            </Link>
          ))
        )}
      </Section>

      {upcoming.length > 0 ? (
        <Section title="Later this month" count={upcoming.length}>
          {upcoming.map((duty) => (
            <DutyRow key={duty.id} duty={duty} detail={duty.when} />
          ))}
        </Section>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Playbook</h2>
      <p className="mt-1 text-sm text-slate-500">
        Every duty, who does it, and what proves it was done.
      </p>
      {CADENCES.map(({ id, label }) => {
        const duties = PLAYBOOK.filter((d) => d.cadence === id);
        return (
          <Section key={id} title={label} count={duties.length}>
            {duties.map((duty) => (
              <PlaybookRow key={duty.id} duty={duty} />
            ))}
          </Section>
        );
      })}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-slate-400">{children}</p>;
}

function DutyRow({ duty, detail }: { duty: Duty; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{duty.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {detail} · {duty.owner}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
        Not connected
      </span>
    </div>
  );
}

function PlaybookRow({ duty }: { duty: Duty }) {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-medium text-slate-900">{duty.title}</p>
        <p className="text-xs text-slate-500">{duty.when}</p>
      </div>
      <p className="mt-1 text-sm text-slate-600">{duty.what}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-slate-400">Who</dt>
        <dd className="text-slate-700">
          {duty.owner}
          {duty.scope === "firm" ? " · firm-wide" : " · every client"}
        </dd>
        <dt className="text-slate-400">Proof</dt>
        <dd className="text-slate-700">{duty.evidence}</dd>
      </dl>
    </div>
  );
}
