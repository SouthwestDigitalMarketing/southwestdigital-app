import Link from "next/link";
import { redirect } from "next/navigation";
import { requireDonna } from "@/lib/donna/access";
import { loadStatus, storageMissing } from "@/lib/donna/store";
import {
  STATES,
  cleanBarStatus,
  cleanBuckets,
  cleanIsSort,
  cleanReport,
  donnaNow,
  donnaSettings,
  workerStats,
  type DonnaState,
} from "@/lib/donna/domain";
import { activityPeriod } from "@/lib/donna/period";
import {
  cancelClean,
  cleanInboxNow,
  mailboxAction,
  updateDonnaSettings,
} from "./actions";
import { DonnaFrame, shortTime } from "./DonnaFrame";

export const dynamic = "force-dynamic";

const QUEUE_LABELS: Record<string, [string, string]> = {
  clean: ["Inbox clean", "Inbox cleans"],
  undo: ["undo", "undos"],
  backlog: ["history pass", "history passes"],
  reconcile: ["mailbox check", "mailbox checks"],
  incoming: ["new-mail read", "new-mail reads"],
};

const DOT: Record<string, string> = {
  working: "animate-pulse bg-emerald-500",
  idle: "bg-emerald-500",
  paused: "bg-amber-500",
  limit: "bg-amber-500",
  offline: "bg-rose-500",
};

const button =
  "rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40";

type Step = {
  id: string;
  status: string;
  options: unknown;
  result: unknown;
  completedAt: Date | null;
  error: string | null;
} | null;

/**
 * Steps (Tom, 2026-11-26): one step at a time, a gate after each. Step 1 sorts Inbox
 * into buckets and moves nothing; step 2 does only what Tom chose for each bucket.
 */
function Steps({
  mailboxId,
  step,
  paused,
  offline,
  progress,
}: {
  mailboxId: string;
  step: Step;
  paused: boolean;
  offline: boolean;
  progress: string | null;
}) {
  const running = step && ["pending", "leased"].includes(step.status);
  const sort = step ? cleanIsSort(step.options) : false;
  const href = step ? `/donna/cleans/${encodeURIComponent(step.id)}` : "";
  const buckets = step && sort ? cleanBuckets(step.result) : [];
  const sorted = buckets.reduce((n, b) => n + b.items.length, 0);
  const moved =
    step && !sort
      ? (cleanReport(step.result)?.filed.filter((i) => !i.undone).length ?? 0)
      : 0;
  const waitingForTom = step && sort && step.status === "done";
  return (
    <section
      aria-label="Steps"
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm"
    >
      <div>
        <h2 className="font-semibold">Step 1: Sort Inbox into buckets</h2>
        <p className="text-slate-600">
          Donna reads your Inbox emails and puts each one in a bucket, with a
          one-line reason. Nothing moves, nothing is marked read, nothing is
          sent. Then you choose what to do with each bucket.
        </p>
      </div>
      {running ? (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <p>
            <Link href={href} className="font-medium underline">
              {sort ? "Step 1 is running" : "Step 2 is running"}
            </Link>
            {progress ? (
              <span className="text-slate-500"> · {progress}</span>
            ) : null}
          </p>
          {paused || offline ? (
            <p className="text-xs text-amber-700">
              {paused
                ? "Donna is paused, so this waits until you resume her."
                : "Donna’s worker on Ripley is not running, so this has not started."}
            </p>
          ) : null}
          <form action={cancelClean}>
            <input type="hidden" name="jobId" value={step.id} />
            <button type="submit" className={button}>
              {sort ? "Stop step 1" : "Stop step 2"}
            </button>
          </form>
        </div>
      ) : (
        <>
          {waitingForTom ? (
            <Link
              href={href}
              className="block rounded-lg bg-slate-900 px-4 py-2.5 text-center text-white"
            >
              Step 1 done: {sorted} emails in {buckets.length} buckets. Choose
              what to do
            </Link>
          ) : step && !sort && step.status === "done" ? (
            <p>
              Last step 2 moved {moved}.{" "}
              <Link href={href} className="underline">
                See the report and Undo
              </Link>
            </p>
          ) : step?.status === "cancelled" ? (
            <p className="text-slate-500">
              The last step was stopped.{" "}
              <Link href={href} className="underline">
                See what it did
              </Link>
            </p>
          ) : null}
          <form
            action={cleanInboxNow}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="mailboxId" value={mailboxId} />
            <label className="flex items-center gap-2">
              <span>Emails to sort</span>
              <select
                name="limit"
                defaultValue="25"
                className="rounded-md border border-slate-200 px-2 py-1"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={paused} className={button}>
              {waitingForTom ? "Start step 1 again" : "Start step 1"}
            </button>
          </form>
          <p className="text-xs text-slate-500">
            Each email uses one review. Newest and client mail are read first.
          </p>
        </>
      )}
    </section>
  );
}

function activityText(a: {
  kind: string;
  detail: string;
  request: { title: string } | null;
}) {
  if (a.kind === "filed")
    return `${a.detail}${a.request ? `: ${a.request.title}` : ""}`;
  if (a.kind === "draft-ready")
    return `Reply drafted${a.request ? `: ${a.request.title}` : ""}`;
  if (a.kind === "failed") return `Problem: ${a.detail}`;
  return a.detail;
}

export default async function DonnaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const params = await searchParams;
  if (STATES.includes(params.tab as DonnaState))
    redirect(
      `/donna/email/work?state=${params.tab}${params.page ? `&page=${encodeURIComponent(params.page)}` : ""}`,
    );
  const { dataContext } = await requireDonna();
  let data;
  try {
    data = await loadStatus(dataContext, activityPeriod("today").start);
  } catch (e) {
    if (!storageMissing(e)) throw e;
    return (
      <DonnaFrame active="overview">
        <p className="text-sm">Donna’s email desk is being set up.</p>
      </DonnaFrame>
    );
  }
  if (!data)
    return (
      <DonnaFrame active="overview">
        <Link href="/donna/settings" className="text-sm underline">
          Connect the mailbox to start Donna.
        </Link>
      </DonnaFrame>
    );
  const { mailbox, active, queued, filedToday, needsYou, recent, step } = data;
  const settings = donnaSettings(mailbox.settings);
  const stats = workerStats(mailbox.coverage);
  const today = new Date().toISOString().slice(0, 10);
  const used = stats?.day === today ? stats.reviews : 0;
  const history = stats?.day === today ? stats.history : 0;
  const progress =
    active?.kind === "clean"
      ? cleanBarStatus(active, mailbox.coverage, new Date(), mailbox.paused)
      : null;
  const now = donnaNow({
    paused: mailbox.paused,
    heartbeatAt: mailbox.heartbeatAt,
    activeKind: active?.kind ?? null,
    progress,
    settings,
    stats,
  });
  const waiting = queued
    .filter((q) => settings.history || ["clean", "undo"].includes(q.kind))
    .map((q) => {
      const [one, many] = QUEUE_LABELS[q.kind] ?? [q.kind, q.kind];
      return `${q._count._all} ${q._count._all === 1 ? one : many}`;
    });
  return (
    <DonnaFrame active="overview">
      <section
        aria-label="What Donna is doing"
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[now.state]}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="font-semibold">{now.headline}</h2>
            <p className="text-sm text-slate-600">{now.detail}</p>
            <p className="mt-1 text-xs text-slate-500">
              Last check-in {shortTime(mailbox.heartbeatAt)} · Up next:{" "}
              {waiting.length ? waiting.join(", ") : "nothing waiting"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={mailboxAction}>
            <input type="hidden" name="mailboxId" value={mailbox.id} />
            <input
              type="hidden"
              name="action"
              value={mailbox.paused ? "resume" : "pause"}
            />
            <button type="submit" className={button}>
              {mailbox.paused ? "Resume Donna" : "Pause Donna"}
            </button>
          </form>
          {settings.steps ? null : (
            <form action={cleanInboxNow}>
              <input type="hidden" name="mailboxId" value={mailbox.id} />
              <button
                type="submit"
                disabled={mailbox.paused || active?.kind === "clean"}
                className={button}
              >
                Clean inbox now
              </button>
            </form>
          )}
          {active?.kind === "clean" && !settings.steps ? (
            <form action={cancelClean}>
              <input type="hidden" name="jobId" value={active.id} />
              <button type="submit" className={button}>
                Stop this clean
              </button>
            </form>
          ) : null}
        </div>
      </section>

      {settings.steps ? (
        <Steps
          mailboxId={mailbox.id}
          step={step}
          paused={mailbox.paused}
          offline={now.state === "offline"}
          progress={
            progress && step && progress.id === step.id
              ? progress.countLabel
              : null
          }
        />
      ) : null}

      <section aria-label="Today" className="grid grid-cols-3 gap-2">
        <Link
          href="/donna/email"
          className="rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-400"
        >
          <p className="text-xl font-semibold tabular-nums">{filedToday}</p>
          <p className="text-xs text-slate-500">Filed today · Undo</p>
        </Link>
        <Link
          href="/donna/email/work?state=needs-you"
          className="rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-400"
        >
          <p className="text-xl font-semibold tabular-nums">{needsYou}</p>
          <p className="text-xs text-slate-500">Need you</p>
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xl font-semibold tabular-nums">
            {used}
            <span className="text-sm font-normal text-slate-400">
              /{settings.dailyReviews}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            Reviews today · history {history}
          </p>
        </div>
      </section>

      <section aria-label="Recent" className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          What she did
        </h3>
        {recent.length ? (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {recent.map((a) => (
              <li key={a.id} className="flex gap-3 px-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-xs tabular-nums text-slate-500">
                  {shortTime(a.occurredAt)}
                </span>
                {a.request ? (
                  <Link
                    href={`/donna/requests/${a.request.id}`}
                    className="min-w-0 flex-1 truncate underline decoration-slate-200"
                  >
                    {activityText(a)}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate">
                    {activityText(a)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Nothing yet.</p>
        )}
      </section>

      <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium">Limits</summary>
        <form action={updateDonnaSettings} className="mt-3 space-y-3">
          <input type="hidden" name="mailboxId" value={mailbox.id} />
          <label className="flex items-center justify-between gap-3">
            <span>Reviews a day</span>
            <select
              name="dailyReviews"
              defaultValue={String(settings.dailyReviews)}
              className="rounded-md border border-slate-200 px-2 py-1"
            >
              {[100, 200, 500, 1000, 2000].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>How Donna works</span>
            <select
              name="steps"
              defaultValue={settings.steps ? "on" : "off"}
              className="rounded-md border border-slate-200 px-2 py-1"
            >
              <option value="on">In steps: only what you start</option>
              <option value="off">On her own</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Read older mail in the background</span>
            <select
              name="history"
              defaultValue={settings.history ? "on" : "off"}
              className="rounded-md border border-slate-200 px-2 py-1"
            >
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Most reviews for older mail</span>
            <select
              name="historyReviews"
              defaultValue={String(settings.historyReviews)}
              className="rounded-md border border-slate-200 px-2 py-1"
            >
              {[0, 30, 60, 120, 250].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-500">
            In steps, she does not read older mail or new mail on her own.
            Reviews use your ChatGPT plan’s Codex allowance; the count resets at
            6 pm Central.
          </p>
          <button type="submit" className={button}>
            Save limits
          </button>
        </form>
      </details>
    </DonnaFrame>
  );
}
