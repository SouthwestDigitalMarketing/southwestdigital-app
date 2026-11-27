import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDonna } from "@/lib/donna/access";
import { loadClean } from "@/lib/donna/store";
import {
  STEP_FOLDERS,
  cleanBarStatus,
  cleanBuckets,
  cleanIsClosed,
  cleanIsDo,
  cleanIsPreview,
  cleanIsSort,
  cleanReport,
  jobEnd,
  jobOutcome,
  sortAwaitsTom,
  mailboxCleanReport,
  type CleanReportItem,
} from "@/lib/donna/domain";
import {
  applyBuckets,
  approveClean,
  closeSort,
  resortJob,
  undoFiled,
} from "../../actions";
import { SortedTable } from "@/components/donna/sortTable";
import { Stepper, type Step } from "@/components/donna/Stepper";
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

/** What step 3 permanently deleted from Spam and Trash, with Tom's approval. */
function Emptied({
  report,
}: {
  report: NonNullable<ReturnType<typeof cleanReport>>;
}) {
  if (report.emptyError)
    return (
      <p role="alert" className="text-sm text-rose-700">
        Emptying Spam and Trash stopped: {report.emptyError}
      </p>
    );
  if (!report.emptied) return null;
  return (
    <p className="text-sm text-slate-700">
      Emptied with your approval:{" "}
      {Object.entries(report.emptied)
        .map(([folder, n]) => `${folder} ${n.toLocaleString("en-US")}`)
        .join(", ")}
      .
    </p>
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
                      : `${item.folder}${item.blocked ? " · sender blocked" : ""}`
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

/** Sort, Choose, Do for a stepped job; null for older single-step cleans. */
function jobSteps(
  job: Awaited<ReturnType<typeof loadClean>> & object,
  now: { countLabel: string; paused: boolean },
): Step[] | null {
  const active = ["pending", "leased"].includes(job.status);
  if (cleanIsSort(job.options)) {
    const buckets = cleanBuckets(job.result);
    const sorted = buckets.reduce((n, b) => n + b.items.length, 0);
    const follow = job.follow;
    const closed = cleanIsClosed(job.options);
    const followActive =
      follow && ["pending", "leased"].includes(follow.status);
    const doHref = follow
      ? `/donna/cleans/${encodeURIComponent(follow.id)}`
      : undefined;
    return [
      {
        label: "Sort",
        state: active ? "current" : "done",
        note: active
          ? `${now.countLabel}${now.paused ? " · paused" : ""}`
          : `${sorted} sorted${job.status === "cancelled" ? " · stopped" : ""}`,
      },
      {
        label: "Choose",
        state: active ? "todo" : follow || closed ? "done" : "yours",
        note: active
          ? "After sorting"
          : follow
            ? "Chosen"
            : closed
              ? "Closed, nothing changed"
              : "Your turn",
      },
      {
        label: "Do",
        state: follow
          ? followActive
            ? "current"
            : "done"
          : closed
            ? "skipped"
            : "todo",
        note: follow
          ? followActive
            ? "Running"
            : `Done · ${jobOutcome({ ...follow, kind: "clean", options: { plan: [] }, error: null })}`
          : closed
            ? "Skipped"
            : "Not started",
        href: doHref,
      },
    ];
  }
  if (cleanIsDo(job.options)) {
    const from = String(
      (job.options as { previewJobId?: unknown }).previewJobId ?? "",
    );
    const sortHref = from
      ? `/donna/cleans/${encodeURIComponent(from)}`
      : undefined;
    return [
      { label: "Sort", state: "done", note: "Sorted", href: sortHref },
      { label: "Choose", state: "done", note: "Chosen", href: sortHref },
      {
        label: "Do",
        state: active ? "current" : "done",
        note: active
          ? `${now.countLabel}${now.paused ? " · paused" : ""}`
          : `${job.status === "cancelled" ? "Stopped" : "Done"} · ${jobOutcome(job)}`,
      },
    ];
  }
  return null;
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
  const awaiting = sortAwaitsTom(job, job.follow);
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
  const progress = cleanBarStatus(
    job,
    job.mailbox.coverage,
    new Date(),
    paused,
    job.mailbox.heartbeatAt,
  );
  const steps = jobSteps(job, progress);
  return (
    <DonnaFrame
      active={jobEnd(job, job.follow).label === "Finished" ? "jobs" : "current"}
      refreshEvery={active ? 3000 : undefined}
    >
      <p className="text-xs font-medium tabular-nums text-slate-500">
        Job #{job.jobNumber}
        {active ? "" : ` · ${jobEnd(job, job.follow).detail}`}
      </p>
      {steps ? (
        <Stepper steps={steps} />
      ) : (
        <header className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-lg font-semibold">
            {preview ? "Inbox check" : "Inbox clean"}
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
      )}
      {sort ? (
        awaiting ? (
          <>
            {report && !report.empty ? (
              // Sorted before Junk and the Spam/Trash sweep existed (Tom, 2026-11-26).
              <form
                action={resortJob}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
              >
                <input type="hidden" name="jobId" value={job.id} />
                <span className="min-w-0 flex-1">
                  Sorted before Junk and Spam/Trash cleanup existed, so this job
                  has no Junk bucket and no emptying.
                </span>
                <button
                  type="submit"
                  disabled={paused}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-white disabled:opacity-40"
                >
                  Sort again with the new rules
                </button>
              </form>
            ) : null}
            <p className="text-sm text-slate-600">
              Donna sorted {report?.reviewed ?? 0} emails and moved nothing.
              {report?.remaining
                ? ` ${report.remaining.toLocaleString("en-US")} were not read this time.`
                : ""}{" "}
              Choose what to do with each bucket, then start step 3.
            </p>
            <BucketChooser
              jobId={job.id}
              buckets={cleanBuckets(job.result)}
              folders={STEP_FOLDERS}
              blocked={
                paused
                  ? "Donna is paused. Resume her on the top bar to start step 3."
                  : null
              }
              action={applyBuckets}
            />
            <form action={closeSort}>
              <input type="hidden" name="jobId" value={job.id} />
              <button
                type="submit"
                className="text-xs text-slate-500 underline"
              >
                Close this job without changing anything
              </button>
            </form>
          </>
        ) : (
          <SortedTable buckets={cleanBuckets(job.result)} />
        )
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
            title="Back in Inbox from Spam/Trash"
            items={report.rescued}
            extra={(item) => item.folder}
          />
          <Emptied report={report} />
          <Items
            title="Left in Inbox"
            items={report.skipped}
            extra={(item) => item.reason}
          />
        </>
      ) : active ? null : job.status === "cancelled" && !report ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Cancelled before Donna moved anything.
        </p>
      ) : report ? (
        <>
          {job.status === "cancelled" ? (
            <p className="text-sm text-slate-600">
              Stopped. Anything moved before you stopped stays moved; you can
              undo it below.
            </p>
          ) : null}
          {steps ? null : (
            <p className="text-sm text-slate-600">
              {preview
                ? `Read ${report.reviewed.toLocaleString("en-US")}`
                : `Filed ${report.filed.filter((i) => !i.undone).length.toLocaleString("en-US")}`}
              {report.remaining
                ? ` · Not looked at yet ${report.remaining.toLocaleString("en-US")}`
                : ""}
            </p>
          )}
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
            title="Back in Inbox from Spam/Trash"
            items={report.rescued}
            extra={(item) => item.folder}
          />
          <Emptied report={report} />
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
