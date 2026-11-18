import { requireStaffBrand } from "@/lib/brands/staff";
import { loadBoard } from "@/lib/operations/api";
import { CADENCES, PLAYBOOK, upcomingThisMonth, type Duty } from "@/lib/operations/playbook";
import {
  STATE_LABEL,
  TRACKING_STARTS,
  firmDateKey,
  healthOf,
  type BoardItem,
  type DutyState,
  type Health,
} from "@/lib/operations/schedule";

const PROBLEM: DutyState[] = ["overdue", "failed"];

export default async function OperationsPage() {
  const { brand } = await requireStaffBrand();
  const now = new Date();
  const { clients, items } = await loadBoard(brand.id, now);
  const todayKey = firmDateKey(now);

  const problems = items.filter((i) => PROBLEM.includes(i.state));
  const needsYou = items.filter((i) => i.state === "needs_tom");
  const waiting = items.filter((i) => i.state === "waiting_client");
  const dueLater = items.filter((i) => i.state === "due");
  const done = items.filter((i) => i.state === "done");
  const upcoming = upcomingThisMonth(now);
  const todayLabel = now.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const clientRows = clients
    .map((client) => {
      const own = items.filter((i) => i.client?.id === client.id);
      return { client, own, health: healthOf(own) };
    })
    .sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || a.client.name.localeCompare(b.client.name));

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">Operations</h1>
      <p className="mt-1 text-sm text-slate-500">{todayLabel}</p>

      {todayKey < TRACKING_STARTS ? (
        <Notice>
          Tracking starts {formatDay(TRACKING_STARTS)}. From then on a duty turns green only when an
          agent posts evidence for it, and anything past due with no evidence shows as overdue.
        </Notice>
      ) : null}
      {clients.length === 0 ? (
        <Notice>No clients are enrolled in Operations yet, so only firm-wide duties show.</Notice>
      ) : null}

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Count label="Problems" value={problems.length} tone={problems.length ? "red" : "slate"} />
        <Count label="Needs you" value={needsYou.length} tone={needsYou.length ? "amber" : "slate"} />
        <Count label="Waiting" value={waiting.length} tone={waiting.length ? "amber" : "slate"} />
        <Count label="Done" value={done.length} tone={done.length ? "green" : "slate"} />
      </div>

      {problems.length > 0 ? (
        <Section title="Problems" count={problems.length}>
          {groupItems(problems).map((group) => (
            <GroupRow key={group.key} items={group.items} todayKey={todayKey} />
          ))}
        </Section>
      ) : null}
      {needsYou.length > 0 ? (
        <Section title="Needs you" count={needsYou.length}>
          {groupItems(needsYou).map((group) => (
            <GroupRow key={group.key} items={group.items} todayKey={todayKey} />
          ))}
        </Section>
      ) : null}
      {waiting.length > 0 ? (
        <Section title="Waiting on client" count={waiting.length}>
          {groupItems(waiting).map((group) => (
            <GroupRow key={group.key} items={group.items} todayKey={todayKey} />
          ))}
        </Section>
      ) : null}
      <Section title="Still due" count={dueLater.length}>
        {dueLater.length === 0 ? (
          <Empty>Nothing else due.</Empty>
        ) : (
          groupItems(dueLater).map((group) => (
            <GroupRow key={group.key} items={group.items} todayKey={todayKey} />
          ))
        )}
      </Section>
      {done.length > 0 ? (
        <details className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <summary className="flex cursor-pointer items-baseline justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Done</span>
            <span className="font-normal text-slate-400">{done.length}</span>
          </summary>
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {groupItems(done).map((group) => (
              <GroupRow key={group.key} items={group.items} todayKey={todayKey} />
            ))}
          </div>
        </details>
      ) : null}

      <Section title="Clients" count={clients.length}>
        {clients.length === 0 ? (
          <Empty>No clients enrolled.</Empty>
        ) : (
          clientRows.map(({ client, own, health }) => (
            <div key={client.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${HEALTH_DOT[health]}`} aria-hidden />
                <span className="truncate font-medium text-slate-900">{client.name}</span>
                {client.stage === "onboarding" ? (
                  <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">New client</span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-slate-500">{clientSummary(own)}</span>
            </div>
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

const HEALTH_RANK: Record<Health, number> = { red: 0, amber: 1, green: 2, none: 3 };
const HEALTH_DOT: Record<Health, string> = {
  red: "bg-red-500",
  amber: "bg-amber-400",
  green: "bg-emerald-500",
  none: "bg-slate-300",
};
const STATE_BADGE: Record<DutyState, string> = {
  failed: "bg-red-100 text-red-800",
  overdue: "bg-red-100 text-red-800",
  needs_tom: "bg-amber-100 text-amber-900",
  waiting_client: "bg-amber-100 text-amber-900",
  due: "bg-slate-100 text-slate-600",
  done: "bg-emerald-100 text-emerald-800",
};

/** One row per duty and state, so 40 clients over several days read as one line. */
function groupItems(items: BoardItem[]) {
  const groups = new Map<string, BoardItem[]>();
  for (const item of items) {
    const key = `${item.duty.id}|${item.state}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups].map(([key, grouped]) => ({ key, items: grouped }));
}

function formatDay(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function whenLabel(item: BoardItem, todayKey: string) {
  const time = item.dueAt.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
  });
  return item.period === todayKey ? `Today ${time}` : formatDay(item.period);
}

function groupDetail(items: BoardItem[], todayKey: string) {
  const clientCount = new Set(items.map((i) => i.client?.id ?? "firm")).size;
  const days = new Set(items.map((i) => i.period));
  const who = items[0].client ? `${clientCount} client${clientCount === 1 ? "" : "s"}` : "Firm-wide";
  if (days.size === 1) return `${who} · ${whenLabel(items[0], todayKey)}`;
  const oldest = [...days].sort()[0];
  return `${who} · ${days.size} days, oldest ${formatDay(oldest)}`;
}

function clientSummary(own: BoardItem[]) {
  const bad = own.filter((i) => PROBLEM.includes(i.state)).length;
  const waiting = own.filter((i) => i.state === "waiting_client" || i.state === "needs_tom").length;
  const doneCount = own.filter((i) => i.state === "done").length;
  if (own.length === 0) return "nothing due yet";
  const parts = [];
  if (bad) parts.push(`${bad} overdue`);
  if (waiting) parts.push(`${waiting} waiting`);
  parts.push(`${doneCount} of ${own.length} done`);
  return parts.join(" · ");
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {children}
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "green" | "slate" }) {
  const color = {
    red: "text-red-700",
    amber: "text-amber-700",
    green: "text-emerald-700",
    slate: "text-slate-400",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-2 py-3">
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function GroupRow({ items, todayKey }: { items: BoardItem[]; todayKey: string }) {
  const [first] = items;
  if (items.length === 1) return <ItemRow item={first} todayKey={todayKey} />;
  return (
    <details>
      <summary className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{first.duty.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {groupDetail(items, todayKey)} · {first.duty.owner}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATE_BADGE[first.state]}`}>
          {STATE_LABEL[first.state]}
        </span>
      </summary>
      <ul className="space-y-2 px-4 pb-3 text-xs">
        {items.map((item) => (
          <li key={`${item.client?.id ?? "firm"}|${item.period}`}>
            <span className="font-medium text-slate-700">{item.client?.name ?? "Firm-wide"}</span>
            <span className="text-slate-500"> · {whenLabel(item, todayKey)}</span>
            {item.evidence ? (
              <span className="text-slate-500">
                {" "}
                · {item.evidence.summary} · {item.evidence.reportedBy}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ItemRow({ item, todayKey }: { item: BoardItem; todayKey: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{item.duty.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {item.client?.name ?? "Firm-wide"} · {whenLabel(item, todayKey)} · {item.duty.owner}
        </p>
        {item.evidence ? (
          <p className="mt-1 text-xs text-slate-600">
            {item.evidence.summary}
            <span className="text-slate-400"> · {item.evidence.reportedBy}</span>
            {item.evidence.sourceRef ? (
              <span className="block truncate text-slate-400">{item.evidence.sourceRef}</span>
            ) : null}
          </p>
        ) : null}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATE_BADGE[item.state]}`}>
        {STATE_LABEL[item.state]}
      </span>
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
