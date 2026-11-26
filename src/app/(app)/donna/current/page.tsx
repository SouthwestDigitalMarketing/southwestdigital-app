import Link from "next/link";
import { redirect } from "next/navigation";
import { requireDonna } from "@/lib/donna/access";
import {
  loadActiveClean,
  loadAwaitingSort,
  storageMissing,
} from "@/lib/donna/store";
import { DonnaFrame, DonnaStart } from "../DonnaFrame";

export const dynamic = "force-dynamic";

/**
 * Current job tab: the running job, else a sorted job waiting for Tom's choices,
 * else Start new job.
 */
export default async function CurrentJobPage() {
  const { dataContext } = await requireDonna();
  let job = null;
  try {
    job =
      (await loadActiveClean(dataContext)) ??
      (await loadAwaitingSort(dataContext));
  } catch (e) {
    if (!storageMissing(e)) throw e;
  }
  if (job) redirect(`/donna/cleans/${encodeURIComponent(job.id)}`);
  return (
    <DonnaFrame active="current">
      <p className="text-sm text-slate-600">
        No job is running. Finished jobs are on{" "}
        <Link href="/donna/jobs" className="underline">
          Completed jobs
        </Link>
        .
      </p>
      <DonnaStart />
    </DonnaFrame>
  );
}
