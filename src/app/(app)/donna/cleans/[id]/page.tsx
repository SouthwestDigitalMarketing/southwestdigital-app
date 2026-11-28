import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDonna } from "@/lib/donna/access";
import { loadClean } from "@/lib/donna/store";
import {
  STEP_FOLDERS,
  cleanBarStatus,
  cleanBuckets,
  cleanIsCleanup,
  cleanIsClosed,
  cleanIsDo,
  cleanupHasWork,
  cleanupPlan,
  cleanupSkipped,
  chooseSkipped,
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
  applyCleanup,
  skipCleanup,
  approveClean,
  closeSort,
  skipChoose,
  resortJob,
  undoFiled,
} from "../../actions";
import { SortedTable } from "@/components/donna/sortTable";
import { CleanupChooser } from "@/components/donna/CleanupChooser";
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
  const zoho = report.zoho ? (
    report.zoho.error ? (
      <p role="alert" className="text-sm text-amber-700">
        Zoho was not updated: {report.zoho.error}
      </p>
    ) : (
      <p className="text-sm text-slate-700">
        In Zoho: {report.zoho.spam} blocked sender
        {report.zoho.spam === 1 ? "" : "s"} now go straight to Spam;{" "}
        {report.zoho.allow} on the allow list.
      </p>
    )
  ) : null;
  if (report.emptyError)
    return (
      <>
        {zoho}
        <p role="alert" className="text-sm text-rose-700">
          Emptying Spam and Trash stopped: {report.emptyError}
        </p>
      </>
    );
  if (!report.emptied) return zoho;
  return (
    <>
      {zoho}
      <p className="text-sm text-slate-700">
        Emptied with your approval:{" "}
        {Object.entries(report.emptied)
          .map(([folder, n]) => `${folder} ${n.toLocaleString("en-US")}`)
          .join(", ")}
        .
      </p>
    </>
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
  // Whichever record is open, the job is its sort plus steps 3 and 4.
  const sort = cleanIsSort(job.options)
    ? job
    : job.parent && cleanIsSort(job.parent.options)
      ? job.parent
      : null;
  if (!sort) return null;
  const doJob = cleanIsDo(job.options) ? job : job.follow;
  const cleanupJob = cleanIsCleanup(job.options) ? job : job.cleanupJob;
  const running = (j: { status: string } | null | undefined) =>
    Boolean(j && ["pending", "leased"].includes(j.status));
  const progressNote = `${now.countLabel}${now.paused ? " · paused" : ""}`;
  const href = (id: string) => `/donna/cleans/${encodeURIComponent(id)}`;
  const outcome = (j: { status: string; options: unknown; result: unknown }) =>
    jobOutcome({ ...j, kind: "clean", error: null });
  const sorted = cleanBuckets(sort.result).reduce(
    (n, b) => n + b.items.length,
    0,
  );
  const closed = cleanIsClosed(sort.options);
  const skippedChoose = chooseSkipped(sort.options);
  const doneDo = (doJob && doJob.status === "done") || skippedChoose;
  const plan = cleanupPlan(sort.result);
  return [
    {
      label: "Sort",
      state: running(sort) ? "current" : "done",
      note: running(sort)
        ? progressNote
        : `${cleanReport(sort.result)?.reviewed ?? sorted} read${sort.status === "cancelled" ? " · stopped" : ""}`,
      href: sort.id === job.id ? undefined : href(sort.id),
    },
    {
      label: "Choose",
      state: running(sort)
        ? "todo"
        : doJob || closed || skippedChoose
          ? "done"
          : "yours",
      note: running(sort)
        ? "After sorting"
        : skippedChoose
          ? "Nothing to do"
          : doJob
            ? "Chosen"
            : closed
              ? "Closed, nothing changed"
              : "Your turn",
      href: sort.id === job.id ? undefined : href(sort.id),
    },
    {
      label: "Do",
      state: doJob
        ? running(doJob)
          ? "current"
          : "done"
        : closed || skippedChoose
          ? "skipped"
          : "todo",
      note: doJob
        ? running(doJob)
          ? doJob.id === job.id
            ? progressNote
            : "Running"
          : `${doJob.status === "cancelled" ? "Stopped" : "Done"} · ${outcome(doJob)}`
        : closed || skippedChoose
          ? "Skipped"
          : "Not started",
      href: doJob && doJob.id !== job.id ? href(doJob.id) : undefined,
    },
    {
      label: "Spam",
      state: cleanupJob
        ? running(cleanupJob)
          ? "current"
          : "done"
        : closed || cleanupSkipped(sort.options)
          ? "skipped"
          : doneDo
            ? cleanupHasWork(sort.result)
              ? "yours"
              : "done"
            : "todo",
      note: cleanupJob
        ? running(cleanupJob)
          ? cleanupJob.id === job.id
            ? progressNote
            : "Running"
          : `${cleanupJob.status === "cancelled" ? "Stopped" : "Done"} · ${outcome(cleanupJob)}`
        : closed || cleanupSkipped(sort.options)
          ? "Skipped"
          : doneDo
            ? cleanupHasWork(sort.result)
              ? "Your turn"
              : "Nothing to clean"
            : plan
              ? "Next"
              : "Not started",
      href: cleanupJob
        ? cleanupJob.id === job.id
          ? undefined
          : href(cleanupJob.id)
        : doneDo && sort.id !== job.id
          ? href(sort.id)
          : undefined,
    },
  ];
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
  // How the whole job stands (its sort with steps 3 and 4), whichever page is open.
  const sortRec = cleanIsSort(job.options)
    ? job
    : job.parent && cleanIsSort(job.parent.options)
      ? job.parent
      : null;
  const end = sortRec
    ? jobEnd(
        sortRec,
        cleanIsDo(job.options) ? job : job.follow,
        cleanIsCleanup(job.options) ? job : job.cleanupJob,
      )
    : jobEnd(job, job.follow);
  // Step 4 waits for Tom on the sort's page once step 3 is done.
  const plan = sort ? cleanupPlan(job.result) : null;
  const cleanupTurn =
    sort &&
    plan !== null &&
    (job.follow?.status === "done" || chooseSkipped(job.options)) &&
    !job.cleanupJob &&
    !cleanupSkipped(job.options) &&
    !cleanIsClosed(job.options) &&
    cleanupHasWork(job.result);
  return (
    <DonnaFrame
      active={end.label === "Finished" ? "jobs" : "current"}
      refreshEvery={active ? 3000 : undefined}
    >
      <p className="text-xs font-medium tabular-nums text-slate-500">
        Job #{job.jobNumber}
        {active ? "" : ` · ${end.detail}`}
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
              {(report?.reviewed ?? 0).toLocaleString("en-US")} read
              {report?.remaining
                ? ` · ${report.remaining.toLocaleString("en-US")} left for the next job`
                : ""}
              . Spam is in step 4.
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
            <form action={skipChoose}>
              <input type="hidden" name="jobId" value={job.id} />
              <button
                type="submit"
                className="text-xs text-slate-500 underline"
              >
                Nothing to do here: go to the Spam step
              </button>
            </form>
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
        ) : cleanupTurn && plan ? (
          <>
            <p className="text-sm text-slate-600">
              Step 4: Spam. Everything Donna found as spam, one row per sender:
              the ones she is sure of first, then the ones to check. Spam
              senders are unsubscribed where it is safe, blocked in Zoho, and
              their mail goes to Trash. Emptying Trash needs its own Approve
              tick.
            </p>
            <CleanupChooser
              jobId={job.id}
              plan={plan}
              blocked={
                paused
                  ? "Donna is paused. Resume her on the top bar to clean up."
                  : null
              }
              action={applyCleanup}
            />
            <form action={skipCleanup}>
              <input type="hidden" name="jobId" value={job.id} />
              <button
                type="submit"
                className="text-xs text-slate-500 underline"
              >
                Skip the Spam step this time
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
          <Items
            title="Marked spam: blocked, mail to Trash"
            items={report.blocked}
          />
          <Items
            title="Unsubscribe"
            items={report.unsubscribed}
            extra={(item) => item.reason}
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
          <Items
            title="Marked spam: blocked, mail to Trash"
            items={report.blocked}
          />
          <Items
            title="Unsubscribe"
            items={report.unsubscribed}
            extra={(item) => item.reason}
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
