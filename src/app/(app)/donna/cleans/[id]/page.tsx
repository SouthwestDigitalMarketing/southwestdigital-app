import Link from "next/link";
import { Info } from "lucide-react";
import { notFound } from "next/navigation";
import { requireDonna } from "@/lib/donna/access";
import { loadClean } from "@/lib/donna/store";
import {
  STEP_FOLDERS,
  cleanBuckets,
  cleanIsPreview,
  cleanIsSort,
  type Bucket,
  cleanReport,
  mailboxCleanReport,
  type CleanReportItem,
} from "@/lib/donna/domain";
import { applyBuckets, approveClean, undoFiled } from "../../actions";
import { BucketChooser } from "@/components/donna/BucketChooser";
import { DonnaFrame, shortTime } from "../../DonnaFrame";

export const dynamic = "force-dynamic";

const listClass =
  "divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white";

function Heading({ title, count }: { title: string; count: number }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {title}{" "}
      <span className="font-normal tabular-nums text-slate-400">{count}</span>
    </h3>
  );
}

function Line({ item, extra }: { item: CleanReportItem; extra?: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm">{item.subject}</span>
      <span className="block truncate text-xs text-slate-500">
        {[item.from, extra].filter(Boolean).join(" · ")}
      </span>
    </span>
  );
}

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
      <Heading title={title} count={items.length} />
      <ul className={listClass}>
        {items.map((item, i) => (
          <li key={`${item.subject}-${i}`} className="flex px-3 py-2">
            <Line item={item} extra={extra?.(item)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What Donna would file. Every row starts ticked; untick to keep it in Inbox. */
function PreviewPlan({
  jobId,
  items,
  approvedJobId,
  paused,
}: {
  jobId: string;
  items: CleanReportItem[];
  approvedJobId: string | null;
  paused: boolean;
}) {
  const choosable = items.filter((item) => item.thread);
  if (!items.length)
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Donna found nothing to file this time.
      </p>
    );
  return (
    <form action={approveClean} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <Heading title="Donna would file" count={items.length} />
      <ul className={listClass}>
        {items.map((item, i) => (
          <li key={`${item.thread ?? item.subject}-${i}`}>
            <label className="flex items-center gap-3 px-3 py-2">
              <input
                type="checkbox"
                name="thread"
                value={item.thread ?? ""}
                defaultChecked={Boolean(item.thread)}
                disabled={!item.thread || Boolean(approvedJobId)}
                className="h-4 w-4 shrink-0"
              />
              <Line
                item={item}
                extra={item.folder ? `to ${item.folder}` : undefined}
              />
            </label>
          </li>
        ))}
      </ul>
      {approvedJobId ? (
        <Link
          href={`/donna/cleans/${encodeURIComponent(approvedJobId)}`}
          className="block rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm"
        >
          Already approved. See what was filed
        </Link>
      ) : paused ? (
        <p className="text-xs text-amber-700">
          Donna is paused. Resume her in Settings to file these.
        </p>
      ) : (
        <>
          <button
            type="submit"
            disabled={!choosable.length}
            className="block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm text-white sm:w-auto"
          >
            File the ticked emails
          </button>
          <p className="text-xs text-slate-500">
            Nothing has moved yet. Untick anything you want to keep in Inbox.
            Anything that changes before Donna files it stays in Inbox.
          </p>
        </>
      )}
    </form>
  );
}

/** Sender's name, or the address when there is no name. */
function senderName(from: string) {
  const name = from
    .replace(/<[^>]*>/, "")
    .replace(/"/g, "")
    .trim();
  return name || from;
}

/**
 * Soft tints that set each bucket's rows apart, with alternating rows a shade
 * deeper inside a bucket (Tom, 2026-11-26).
 */
const BUCKET_TINTS = [
  ["bg-sky-50", "bg-sky-100/60"],
  ["bg-amber-50", "bg-amber-100/60"],
  ["bg-emerald-50", "bg-emerald-100/60"],
  ["bg-violet-50", "bg-violet-100/60"],
  ["bg-rose-50", "bg-rose-100/60"],
  ["bg-teal-50", "bg-teal-100/60"],
  ["bg-orange-50", "bg-orange-100/60"],
  ["bg-indigo-50", "bg-indigo-100/60"],
];

/** One colour per type group, so a scam or a money email stands out. */
const TYPE_DOTS: Record<string, string> = {
  People: "bg-sky-500",
  Money: "bg-emerald-500",
  Systems: "bg-slate-500",
  Marketing: "bg-violet-500",
  Unwanted: "bg-rose-500",
  Other: "bg-slate-300",
};

/** Step 1 while it runs: one table, a row per email, grouped by bucket (Tom, 2026-11-26). */
function LiveBuckets({ buckets }: { buckets: Bucket[] }) {
  if (!buckets.length)
    return (
      <p className="text-sm text-slate-500">
        Emails appear here as Donna sorts each one.
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table
        aria-label="Sorted emails"
        className="w-full min-w-[640px] text-left text-xs"
      >
        <thead className="uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="px-2 py-1 font-semibold">Bucket</th>
            <th className="px-2 py-1 font-semibold">Email</th>
            <th className="px-2 py-1 font-semibold">Type</th>
            <th className="px-2 py-1 font-semibold">From</th>
            <th className="px-2 py-1 font-semibold">Client</th>
            <th className="w-8 px-2 py-1 font-semibold">
              <span className="sr-only">Why</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {buckets.flatMap((bucket, b) =>
            bucket.items.map((item, i) => (
              <tr
                key={item.thread}
                className={`align-top ${BUCKET_TINTS[b % BUCKET_TINTS.length][i % 2]}`}
              >
                <td className="whitespace-nowrap px-2 py-1 font-medium">
                  {i ? "" : `${bucket.name} (${bucket.items.length})`}
                </td>
                <td className="max-w-[16rem] truncate px-2 py-1">
                  {item.subject}
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                  {item.type ? (
                    <span
                      title={item.typeHint || item.type}
                      className="inline-flex items-center gap-1"
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${TYPE_DOTS[item.typeGroup] ?? TYPE_DOTS.Other}`}
                      />
                      {item.type}
                      {item.typeNew ? (
                        <span className="rounded bg-slate-900 px-1 text-[10px] leading-4 text-white">
                          new
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </td>
                <td
                  className="max-w-[12rem] truncate px-2 py-1 text-slate-600"
                  title={item.from}
                >
                  {senderName(item.from)}
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                  {item.client ?? ""}
                </td>
                <td className="px-2 py-1 text-slate-400">
                  {item.why ? (
                    // Hover (or focus) shows Donna's reason.
                    <span
                      role="img"
                      tabIndex={0}
                      title={item.why}
                      aria-label={`Why: ${item.why}`}
                      className="inline-flex cursor-help hover:text-slate-700 focus:text-slate-700"
                    >
                      <Info size={14} aria-hidden="true" />
                    </span>
                  ) : null}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function FiledWithUndo({
  jobId,
  items,
  paused,
}: {
  jobId: string;
  items: CleanReportItem[];
  paused: boolean;
}) {
  if (!items.length) return null;
  const undoable = items.filter(
    (item) => item.thread && !item.undone && !item.undoPending,
  );
  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <Heading title="Filed" count={items.length} />
        {undoable.length > 1 && !paused ? (
          <form action={undoFiled}>
            <input type="hidden" name="jobId" value={jobId} />
            <input type="hidden" name="thread" value="all" />
            <button type="submit" className="text-xs underline">
              Undo all
            </button>
          </form>
        ) : null}
      </div>
      <ul className={listClass}>
        {items.map((item, i) => (
          <li
            key={`${item.thread ?? item.subject}-${i}`}
            className="flex items-center gap-3 px-3 py-2"
          >
            <Line
              item={item}
              extra={
                item.undone
                  ? "Back in Inbox"
                  : item.undoPending
                    ? "Moving back to Inbox…"
                    : item.undoError
                      ? `${item.folder} · Undo failed: ${item.undoError}`
                      : item.folder
              }
            />
            {item.thread && !item.undone && !item.undoPending && !paused ? (
              <form action={undoFiled} className="shrink-0">
                <input type="hidden" name="jobId" value={jobId} />
                <input type="hidden" name="thread" value={item.thread} />
                <button
                  type="submit"
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs"
                >
                  Undo
                </button>
              </form>
            ) : null}
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
  const preview = cleanIsPreview(job.options);
  const sort = cleanIsSort(job.options);
  const stepTwo =
    !sort &&
    Array.isArray((job.options as { plan?: unknown } | null)?.plan) &&
    (job.options as { buckets?: unknown }).buckets === true;
  // Jobs from before per-job reports fall back to the mailbox's last report.
  const legacy =
    !job.options ||
    (typeof job.options === "object" && !Object.keys(job.options).length);
  const report =
    cleanReport(job.result) ??
    (legacy && job.status === "done"
      ? mailboxCleanReport(job.mailbox.coverage)
      : null);
  const paused = job.mailbox.paused;
  return (
    <DonnaFrame
      active={active ? "current" : "jobs"}
      refreshEvery={active ? 3000 : undefined}
    >
      <header className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-lg font-semibold">
          {sort
            ? active
              ? "Step 1: sorting Inbox into buckets"
              : "Step 1: Inbox sorted into buckets"
            : stepTwo
              ? "Step 2: what Donna moved"
              : preview
                ? "Inbox check"
                : "Inbox clean"}
        </h2>
        <span className="text-sm text-slate-500">
          {active
            ? null
            : job.status === "done"
              ? `Finished ${shortTime(job.completedAt)}`
              : job.status === "cancelled"
                ? `Stopped ${shortTime(job.completedAt)}`
                : job.status}
        </span>
      </header>
      {active && sort ? (
        <LiveBuckets buckets={cleanBuckets(job.result)} />
      ) : active && report ? (
        <>
          <Items
            title="Moved"
            items={report.filed}
            extra={(item) => item.folder}
          />
          <Items
            title="Tagged in Zoho"
            items={report.tagged}
            extra={(item) => item.tag}
          />
          <Items
            title="Left in Inbox"
            items={report.skipped}
            extra={(item) => item.reason}
          />
        </>
      ) : null}
      {active ? null : job.status === "cancelled" && !report ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Cancelled before Donna moved anything.
        </p>
      ) : sort && report ? (
        <>
          <p className="text-sm text-slate-600">
            Donna read {report?.reviewed ?? 0} emails and moved nothing.
            {report?.remaining
              ? ` ${report.remaining.toLocaleString("en-US")} were not read this time.`
              : ""}{" "}
            Choose what to do with each bucket, then start step 2.
          </p>
          {job.approvedJobId ? (
            <Link
              href={`/donna/cleans/${encodeURIComponent(job.approvedJobId)}`}
              className="block rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm"
            >
              Step 2 already started from this sort. See what it did
            </Link>
          ) : (
            <BucketChooser
              jobId={job.id}
              buckets={cleanBuckets(job.result)}
              folders={STEP_FOLDERS}
              blocked={
                paused
                  ? "Donna is paused. Resume her on the Overview to start step 2."
                  : null
              }
              action={applyBuckets}
            />
          )}
        </>
      ) : report ? (
        <>
          {job.status === "cancelled" ? (
            <p className="text-sm text-slate-600">
              Cancelled. Anything filed before you cancelled stays filed; you
              can undo it below.
            </p>
          ) : null}
          <p className="text-sm text-slate-600">
            {preview
              ? `Read ${report.reviewed.toLocaleString("en-US")}`
              : `Filed ${report.filed.filter((i) => !i.undone).length.toLocaleString("en-US")}`}
            {report.remaining
              ? ` · Not looked at yet ${report.remaining.toLocaleString("en-US")}`
              : ""}
          </p>
          {preview ? (
            <PreviewPlan
              jobId={job.id}
              items={report.filed}
              approvedJobId={job.approvedJobId}
              paused={paused}
            />
          ) : (
            <FiledWithUndo
              jobId={job.id}
              items={report.filed}
              paused={paused}
            />
          )}
          <Items
            title="Tagged in Zoho"
            items={report.tagged}
            extra={(item) => item.tag}
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
      {job.error ? (
        <p role="alert" className="text-xs text-rose-700">
          {job.error}
        </p>
      ) : null}
    </DonnaFrame>
  );
}
