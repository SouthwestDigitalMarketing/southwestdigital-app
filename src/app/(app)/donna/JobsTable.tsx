import Link from "next/link";
import type { JobRow } from "@/lib/donna/store";
import { jobEnd, jobOutcome, jobTitle } from "@/lib/donna/domain";
import { reopenSort } from "./actions";
import { shortTime } from "./DonnaFrame";

const STATUS_TONE: Record<string, string> = {
  Running: "text-sky-700",
  Waiting: "font-medium text-amber-700",
  Closed: "text-slate-500",
  Stopped: "text-rose-700",
  Finished: "text-slate-500",
};

/**
 * Jobs in progress and Completed jobs (Tom, 2026-11-26): one compact table each.
 * A job closed at step 2 can be reopened from here.
 */
export function JobsTable({ label, jobs }: { label: string; jobs: JobRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table
        aria-label={label}
        className="w-full min-w-[640px] text-left text-xs"
      >
        <thead className="uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="px-2 py-1 font-semibold">Job #</th>
            <th className="px-2 py-1 font-semibold">When</th>
            <th className="px-2 py-1 font-semibold">Job</th>
            <th className="px-2 py-1 font-semibold">Result</th>
            <th className="px-2 py-1 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {jobs.map((job, i) => {
            const href =
              job.kind === "clean"
                ? `/donna/cleans/${encodeURIComponent(job.id)}`
                : null;
            const outcome = jobOutcome(job, job.follow, job.cleanup);
            const end = jobEnd(job, job.follow, job.cleanup);
            return (
              <tr
                key={job.id}
                className={`align-top ${i % 2 ? "bg-slate-50" : "bg-white"} hover:bg-sky-50`}
              >
                <td className="whitespace-nowrap px-2 py-1 font-medium tabular-nums">
                  {job.number}
                </td>
                <td className="whitespace-nowrap px-2 py-1 tabular-nums text-slate-500">
                  {shortTime(job.completedAt ?? job.receivedAt)}
                </td>
                <td className="whitespace-nowrap px-2 py-1 font-medium">
                  {href ? (
                    <Link
                      href={href}
                      aria-label={`Job ${job.number}, ${jobTitle(job)}: ${outcome}`}
                      className="underline decoration-slate-300 hover:decoration-slate-700"
                    >
                      {jobTitle(job)}
                    </Link>
                  ) : (
                    jobTitle(job)
                  )}
                </td>
                <td className="px-2 py-1 text-slate-600">{outcome}</td>
                <td className="whitespace-nowrap px-2 py-1">
                  <span
                    className={STATUS_TONE[end.label] ?? ""}
                    title={end.detail}
                  >
                    {end.label === "Waiting" ? "Your turn" : end.label}
                  </span>
                  {end.label === "Closed" ? (
                    <form action={reopenSort} className="ml-2 inline">
                      <input type="hidden" name="jobId" value={job.id} />
                      <button type="submit" className="underline">
                        Reopen
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
