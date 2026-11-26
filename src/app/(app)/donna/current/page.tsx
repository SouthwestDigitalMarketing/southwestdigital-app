import Link from "next/link";
import { redirect } from "next/navigation";
import { requireDonna } from "@/lib/donna/access";
import { loadActiveClean, storageMissing } from "@/lib/donna/store";
import { DonnaFrame } from "../DonnaFrame";

export const dynamic = "force-dynamic";

/** Current job tab: the running job's page, or a note when nothing runs. */
export default async function CurrentJobPage() {
  const { dataContext } = await requireDonna();
  let job = null;
  try {
    job = await loadActiveClean(dataContext);
  } catch (e) {
    if (!storageMissing(e)) throw e;
  }
  if (job) redirect(`/donna/cleans/${encodeURIComponent(job.id)}`);
  return (
    <DonnaFrame active="current">
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No job is running. Start one with the Donna button. Finished jobs are on{" "}
        <Link href="/donna/jobs" className="underline">
          Jobs
        </Link>
        .
      </p>
    </DonnaFrame>
  );
}
