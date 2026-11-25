import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDonna } from "@/lib/donna/access";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import {
  draftSchema,
  evidenceSchema,
  TABS,
  type DonnaState,
} from "@/lib/donna/domain";
import { RequestForm } from "../../RequestForm";
import { DonnaFrame, shortTime } from "../../DonnaFrame";

export const dynamic = "force-dynamic";
export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string; item?: string }>;
}) {
  const { dataContext } = await requireDonna();
  const { id } = await params;
  const p = await searchParams;
  const sections = [
    "summary",
    "reply",
    "source",
    "activity",
    "direction",
    "manage",
    "full",
  ];
  const section = sections.includes(p.section ?? "") ? p.section! : "summary";
  const item = Math.max(0, Number.parseInt(p.item ?? "0") || 0);
  const row = await withBrandDataTransaction(dataContext, (tx) =>
    tx.donnaRequest.findFirst({
      where: { id, mailbox: { brandId: dataContext.brandId } },
      include: {
        activities: {
          orderBy: { occurredAt: "desc" },
          skip: section === "activity" ? item : 0,
          take: 1,
        },
        _count: { select: { activities: true } },
      },
    }),
  );
  if (!row) notFound();
  const parsed = evidenceSchema.array().safeParse(row.evidence);
  const evidence = parsed.success ? parsed.data : [];
  const parsedDraft = draftSchema.safeParse(row.draft);
  const draft = parsedDraft.success ? parsedDraft.data : null;
  const href = (s: string, i?: number) =>
    `/donna/requests/${id}?section=${s}${i !== undefined ? `&item=${i}` : ""}`;
  const hidden = (
    <>
      <input type="hidden" name="requestId" value={row.id} />
      <input type="hidden" name="version" value={row.version} />
    </>
  );
  const index = Math.min(item, Math.max(0, evidence.length - 1));
  const source = evidence[index];
  return (
    <DonnaFrame active="email" live={false}>
      <header className="space-y-1">
        <Link
          href={`/donna/email/work?state=${row.state}`}
          className="text-xs text-slate-500 underline"
        >
          ← {TABS[row.state as DonnaState]}
        </Link>
        <h2 className="line-clamp-2 text-lg font-semibold" title={row.title}>
          {row.title}
        </h2>
        <p className="truncate text-xs text-slate-500">{row.person}</p>
      </header>
      <nav aria-label="Request sections" className="flex gap-2">
        {["summary", "reply", "source", "activity"].map((s) => (
          <Link
            key={s}
            href={href(s)}
            aria-current={section === s ? "page" : undefined}
            className={`rounded-full px-3 py-2 text-xs capitalize ${section === s ? "bg-slate-900 text-white" : "bg-white text-slate-500"}`}
          >
            {s}
          </Link>
        ))}
      </nav>
      {section === "summary" ? (
        <>
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h3 className="text-xs font-medium text-slate-500">
                What they need
              </h3>
              <p className="mt-1 line-clamp-2 text-sm">{row.summary}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-slate-500">
                Donna recommends
              </h3>
              <p className="mt-1 line-clamp-2 text-sm">{row.recommendation}</p>
            </div>
            <Link
              href={href("full")}
              className="inline-block text-xs underline"
            >
              Read full summary
            </Link>
          </section>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href={href("direction")}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white"
            >
              Give direction
            </Link>
            <Link href={href("manage")} className="px-1 py-2 underline">
              Follow-up or completion
            </Link>
          </div>
        </>
      ) : null}
      {section === "full" ? (
        <section
          className="max-h-64 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm"
          tabIndex={0}
          aria-label="Full request summary"
        >
          <h3 className="font-semibold">{row.title}</h3>
          <p className="whitespace-pre-wrap">{row.summary}</p>
          <h3 className="font-semibold">Donna recommends</h3>
          <p className="whitespace-pre-wrap">{row.recommendation}</p>
          <p>Next: {row.nextAction}</p>
          {row.completionNote ? <p>Finished: {row.completionNote}</p> : null}
        </section>
      ) : null}
      {section === "reply" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          {draft ? (
            <>
              <p className="truncate text-xs text-slate-500">
                To: {draft.to.join(", ")}
              </p>
              <p className="truncate text-xs text-slate-500">
                From: {draft.from}
              </p>
              {draft.cc.length ? (
                <p className="truncate text-xs text-slate-500">
                  Cc: {draft.cc.join(", ")}
                </p>
              ) : null}
              <p className="mt-1 truncate text-xs">{draft.subject}</p>
              <p className="text-xs text-slate-500">
                Attachments: {draft.attachments.join(", ") || "None"}
              </p>
              {row.draftStale ? (
                <p role="alert" className="mt-2 text-xs text-amber-800">
                  New mail arrived. Review your saved reply before saving again.
                </p>
              ) : null}
              <RequestForm className="mt-3">
                {hidden}
                <label htmlFor="reply" className="block text-xs font-medium">
                  Edit reply
                </label>
                <textarea
                  id="reply"
                  name="note"
                  defaultValue={draft.body}
                  required
                  maxLength={20000}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                />
                <button
                  name="action"
                  value="draft"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
                >
                  Save reply
                </button>
              </RequestForm>
              <p className="mt-2 text-xs text-slate-500">
                Draft only. Sending is off.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No reply is prepared yet.</p>
          )}
        </section>
      ) : null}
      {section === "direction" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">Give direction</h3>
          <RequestForm className="mt-3">
            {hidden}
            <label htmlFor="direction" className="block text-xs">
              What should Donna do?
            </label>
            <textarea
              id="direction"
              name="note"
              required
              maxLength={4000}
              rows={3}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            />
            <button
              name="action"
              value="direction"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
            >
              Give direction
            </button>
          </RequestForm>
          {row.direction ? (
            <p className="mt-3 line-clamp-2 text-xs text-slate-500">
              Last direction: {row.direction}
            </p>
          ) : null}
        </section>
      ) : null}
      {section === "manage" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold">Follow-up or completion</h3>
          <RequestForm className="mt-3">
            {hidden}
            <label htmlFor="work-note" className="block text-xs">
              Waiting on, next action, or evidence the work is finished
            </label>
            <textarea
              id="work-note"
              name="note"
              required
              maxLength={2000}
              rows={2}
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            />
            <label htmlFor="follow-up" className="block text-xs">
              Follow-up date and time (Central)
            </label>
            <input
              id="follow-up"
              name="followUpAt"
              type="datetime-local"
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <button
                name="action"
                value="follow-up"
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                Set follow-up
              </button>
              <button
                name="action"
                value={row.state === "handled" ? "reopen" : "complete"}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                {row.state === "handled"
                  ? "Reopen request"
                  : "Mark finished with evidence"}
              </button>
            </div>
          </RequestForm>
        </section>
      ) : null}
      {section === "source" ? (
        <>
          <section
            className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm"
            tabIndex={0}
            aria-label="Email source"
          >
            {source ? (
              <>
                <p className="text-xs text-slate-500">
                  {source.from} · {shortTime(new Date(source.at))}
                </p>
                <h3 className="font-medium">{source.subject}</h3>
                <p className="whitespace-pre-wrap">{source.excerpt}</p>
                <p className="text-xs text-slate-500">
                  Attachments: {source.attachments.join(", ") || "None"}
                </p>
              </>
            ) : (
              <p>No source excerpt is available.</p>
            )}
          </section>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Excerpt {evidence.length ? index + 1 : 0} of {evidence.length}
            </span>
            <div className="flex gap-5">
              {index > 0 ? (
                <Link className="underline" href={href("source", index - 1)}>
                  Previous
                </Link>
              ) : null}
              {index + 1 < evidence.length ? (
                <Link className="underline" href={href("source", index + 1)}>
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
      {section === "activity" ? (
        <>
          <section
            className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm"
            tabIndex={0}
            aria-label="Request activity"
          >
            {row.activities[0] ? (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  {row.activities[0].actor === "Donna" ? "Donna" : "You"} ·{" "}
                  {shortTime(row.activities[0].occurredAt)}
                </p>
                <p className="whitespace-pre-wrap">
                  {row.activities[0].detail}
                </p>
              </>
            ) : (
              <p className="text-slate-500">No activity yet.</p>
            )}
          </section>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">
              {row._count.activities ? item + 1 : 0} of {row._count.activities}{" "}
              updates
            </span>
            <div className="flex gap-5">
              {item > 0 ? (
                <Link className="underline" href={href("activity", item - 1)}>
                  Newer
                </Link>
              ) : null}
              {item + 1 < row._count.activities ? (
                <Link className="underline" href={href("activity", item + 1)}>
                  Older
                </Link>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </DonnaFrame>
  );
}
