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
        <ul
          aria-label="Completed jobs"
          className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white"
        >
          {jobs.map((job) => {
            const body = (
              <>
                <span className="w-28 shrink-0 text-xs tabular-nums text-slate-500">
                  {shortTime(job.completedAt ?? job.receivedAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {jobTitle(job)}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {jobOutcome(job)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {STATUS[job.status] ?? job.status}
                </span>
              </>
            );
            return (
              <li key={job.id}>
                {job.kind === "clean" ? (
                  <Link
                    href={`/donna/cleans/${encodeURIComponent(job.id)}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No completed jobs yet.
        </p>
      )}
    </DonnaFrame>
  );
}
