import { requireDonna } from "@/lib/donna/access";
import { loadJobsInProgress, storageMissing } from "@/lib/donna/store";
import { jobEnd } from "@/lib/donna/domain";
import { DonnaFrame, DonnaStart } from "../DonnaFrame";
import { JobsTable } from "../JobsTable";

export const dynamic = "force-dynamic";

/**
 * Jobs in progress (Tom, 2026-11-26): every job that has not run to the end:
 * running, waiting for Tom's choices, stopped or closed part-way. Start new job
 * shows when nothing is running.
 */
export default async function JobsInProgressPage() {
  const { dataContext } = await requireDonna();
  let jobs: Awaited<ReturnType<typeof loadJobsInProgress>> = [];
  try {
    jobs = await loadJobsInProgress(dataContext);
  } catch (e) {
    if (!storageMissing(e)) throw e;
  }
  const running = jobs.some(
    (job) => jobEnd(job, job.follow, job.cleanup).label === "Running",
  );
  return (
    <DonnaFrame active="current" refreshEvery={running ? 5000 : undefined}>
      {running ? null : <DonnaStart />}
      {jobs.length ? (
        <JobsTable label="Jobs in progress" jobs={jobs} discard />
      ) : (
        <p className="text-sm text-slate-600">No jobs in progress.</p>
      )}
    </DonnaFrame>
  );
}
