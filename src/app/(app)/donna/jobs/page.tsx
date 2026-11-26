import { requireDonna } from "@/lib/donna/access";
import { loadJobs, storageMissing } from "@/lib/donna/store";
import { DonnaFrame } from "../DonnaFrame";
import { JobsTable } from "../JobsTable";

export const dynamic = "force-dynamic";

/** Completed jobs (Tom, 2026-11-26): only jobs that ran to the end. */
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
        <JobsTable label="Completed jobs" jobs={jobs} />
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No completed jobs yet.
        </p>
      )}
    </DonnaFrame>
  );
}
