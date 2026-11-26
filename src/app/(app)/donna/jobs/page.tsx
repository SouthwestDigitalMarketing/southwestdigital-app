import Link from "next/link";
import { requireDonna } from "@/lib/donna/access";
import { loadJobs, storageMissing } from "@/lib/donna/store";
import { jobOutcome, jobTitle } from "@/lib/donna/domain";
import { DonnaFrame, shortTime } from "../DonnaFrame";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  pending: "Waiting",
  leased: "Running",
  done: "Finished",
  cancelled: "Stopped",
};

/** Completed jobs tab (Tom, 2026-11-26): every finished job; each opens its report. */
export default async function JobsPage() {
  const { dataContext } = await requireDonna();
  let jobs: Awaited<ReturnType<typeof loadJobs>> = [];
  try {
    jobs = await loadJobs(dataContext);
  } catch (e) {
    if (!storageMissing(e)) throw e;
  }
  return (
    <DonnaFrame active="jobs">
      {jobs.length ? (
        // Same compact table style as the job pages (Tom, 2026-11-26).
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table
            aria-label="Completed jobs"
            className="w-full min-w-[560px] text-left text-xs"
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
                const outcome = jobOutcome(job, job.follow);
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
                    <td className="whitespace-nowrap px-2 py-1 text-slate-500">
                      {STATUS[job.status] ?? job.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No completed jobs yet.
        </p>
      )}
    </DonnaFrame>
  );
}
