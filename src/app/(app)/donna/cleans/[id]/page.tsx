import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDonna } from "@/lib/donna/access";
import { loadClean } from "@/lib/donna/store";
import {
  mailboxCleanReport,
  type CleanReportItem,
} from "@/lib/donna/domain";
import { DonnaFrame, shortTime } from "../../DonnaFrame";

export const dynamic = "force-dynamic";

function Items({
  title,
  items,
  extra,
}: {
  title: string;
  items: CleanReportItem[];
  extra?: (item: CleanReportItem) => string | undefined;
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}{" "}
        <span className="font-normal tabular-nums text-slate-400">
          {items.length}
        </span>
      </h3>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {items.map((item, i) => (
          <li key={`${item.subject}-${i}`} className="px-3 py-2">
            <p className="truncate text-sm">{item.subject}</p>
            <p className="truncate text-xs text-slate-500">
              {[item.from, extra?.(item)].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function CleanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { dataContext } = await requireDonna();
  const { id } = await params;
  const job = await loadClean(dataContext, id);
  if (!job) notFound();
  const active = job.status === "pending" || job.status === "leased";
  const report = mailboxCleanReport(job.mailbox.coverage);
  return (
    <DonnaFrame active="email">
      <header className="space-y-1">
        <Link
          href="/donna/email"
          className="text-xs text-slate-500 underline decoration-slate-300"
        >
          Email
        </Link>
        <h2 className="text-lg font-semibold">Inbox clean</h2>
        <p className="truncate text-sm text-slate-500">{job.mailbox.address}</p>
        <p className="text-xs text-slate-500">
          {active
            ? "In progress"
            : job.status === "done"
              ? `Finished ${shortTime(job.completedAt)}`
              : job.status}
        </p>
      </header>
      {active ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Donna is going through Inbox. Filed mail, waiting items, and anything
          that needs you will show here when this pass finishes.
        </p>
      ) : report ? (
        <>
          <p className="text-sm text-slate-600">
            Reviewed {report.reviewed.toLocaleString("en-US")} · Still in Inbox{" "}
            {report.remaining.toLocaleString("en-US")}
          </p>
          <Items
            title="Filed"
            items={report.filed}
            extra={(item) => item.folder}
          />
          <Items
            title="Waiting"
            items={report.waiting}
            extra={(item) => item.waitingOn}
          />
          <Items
            title="Needs you"
            items={report.needsYou}
            extra={(item) => item.nextAction}
          />
          <Items
            title="Left in Inbox"
            items={report.skipped}
            extra={(item) => item.reason}
          />
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          This clean has finished. The report will appear once the worker writes
          it.
        </p>
      )}
      {job.mailbox.lastError ? (
        <p role="alert" className="text-xs text-rose-700">
          {job.mailbox.lastError}
        </p>
      ) : null}
    </DonnaFrame>
  );
}
