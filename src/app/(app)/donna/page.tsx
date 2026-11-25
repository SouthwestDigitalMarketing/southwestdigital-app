import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, ArrowRight } from "lucide-react";
import { requireDonna } from "@/lib/donna/access";
import { loadDesk, storageMissing } from "@/lib/donna/store";
import { STATES, type DonnaState } from "@/lib/donna/domain";
import { DonnaFrame } from "./DonnaFrame";

export const dynamic = "force-dynamic";
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
    data = await loadDesk(dataContext, "needs-you");
  } catch (e) {
    if (!storageMissing(e)) throw e;
    return (
      <DonnaFrame active="overview">
        <p className="text-sm">Donna’s email desk is being set up.</p>
      </DonnaFrame>
    );
  }
  const needs =
    data.groups.find((g) => g.state === "needs-you")?._count._all ?? 0;
  const paused =
    data.mailboxes.length > 0 && data.mailboxes.every((m) => m.paused);
  const errors = data.mailboxes.some((m) => m.lastError);
  const remaining = data.mailboxes.reduce(
    (n, m) =>
      n +
      Number(
        (m.coverage as { remaining_threads?: number })?.remaining_threads ?? 0,
      ),
    0,
  );
  return (
    <DonnaFrame active="overview">
      <section className="space-y-2 py-2">
        <h2 className="text-lg font-semibold">
          {!data.mailboxes.length
            ? "Let’s set up the email desk."
            : paused
              ? "The email desk is paused."
              : errors
                ? "The email desk needs attention."
                : "Your email desk at a glance."}
        </h2>
        <p className="text-sm text-slate-600">
          {needs
            ? `${needs} request${needs === 1 ? " is" : "s are"} ready for your review.`
            : "No requests are waiting for your decision."}
        </p>
        {remaining > 0 ? (
          <p className="text-xs text-slate-500">
            History review: {remaining.toLocaleString("en-US")} conversations
            left.
          </p>
        ) : null}
      </section>
      <Link
        href={data.mailboxes.length ? "/donna/email" : "/donna/settings"}
        className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-400"
      >
        <span className="rounded-xl bg-slate-100 p-3">
          <Mail size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Email</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.mailboxes.length
              ? `${needs} need you · ${paused ? "Paused" : errors ? "Needs attention" : "Connected"}`
              : "Connect your existing mailbox"}
          </p>
        </div>
        <ArrowRight size={18} className="shrink-0 text-slate-400" />
      </Link>
    </DonnaFrame>
  );
}
