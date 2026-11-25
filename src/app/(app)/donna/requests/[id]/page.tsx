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

export const dynamic = "force-dynamic";
export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { dataContext } = await requireDonna();
  const { id } = await params;
  const row = await withBrandDataTransaction(dataContext, (tx) =>
    tx.donnaRequest.findFirst({
      where: { id, mailbox: { brandId: dataContext.brandId } },
      include: {
        activities: { orderBy: { occurredAt: "desc" }, take: 100 },
        mailbox: { select: { address: true } },
      },
    }),
  );
  if (!row) notFound();
  const evidence = evidenceSchema.array().safeParse(row.evidence);
  const parsedDraft = draftSchema.safeParse(row.draft);
  const draft = parsedDraft.success ? parsedDraft.data : null;
  const hidden = (
    <>
      <input type="hidden" name="requestId" value={row.id} />
      <input type="hidden" name="version" value={row.version} />
    </>
  );
  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-slate-50 text-slate-900 break-words mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <Link className="text-sm underline" href={`/donna?tab=${row.state}`}>
        ← Donna
      </Link>
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {TABS[row.state as DonnaState]} · {row.owner}
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{row.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{row.person}</p>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">What they need</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm">{row.summary}</p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="font-semibold">Donna recommends</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm">{row.recommendation}</p>
        <p className="mt-3 text-sm font-medium">Next: {row.nextAction}</p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Prepared work</h2>
        {draft ? (
          <>
            <dl className="mt-3 space-y-1 text-sm">
              <div>
                <dt className="inline font-medium">From: </dt>
                <dd className="inline">{draft.from}</dd>
              </div>
              <div>
                <dt className="inline font-medium">To: </dt>
                <dd className="inline">{draft.to.join(", ")}</dd>
              </div>
              {draft.cc.length ? <div>Cc: {draft.cc.join(", ")}</div> : null}
              <div>Subject: {draft.subject}</div>
              <div>Attachments: {draft.attachments.join(", ") || "None"}</div>
            </dl>
            {row.draftStale ? (
              <p role="alert" className="mt-3 text-sm text-amber-800">
                New mail arrived after you edited this reply. Your text was
                kept. Review it against the latest conversation before saving
                again.
              </p>
            ) : null}
            <RequestForm className="mt-4 space-y-3">
              {hidden}
              <label className="block text-sm font-medium" htmlFor="reply">
                Edit reply
              </label>
              <textarea
                id="reply"
                name="note"
                defaultValue={draft.body}
                required
                maxLength={20000}
                rows={10}
                className="w-full rounded-lg border border-slate-200 p-3 text-sm"
              />
              <button
                name="action"
                value="draft"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
              >
                Save reply
              </button>
            </RequestForm>
            <p className="mt-3 text-xs text-amber-800">
              Draft only. Sending requires your approval for the exact message.
              No background sends are enabled in this build.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No reply is prepared for this request yet.
          </p>
        )}
        {row.completionNote ? (
          <p className="mt-3 text-sm">Finished: {row.completionNote}</p>
        ) : null}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Give direction</h2>
        {row.direction ? (
          <p className="mt-2 text-sm text-slate-500">
            Your last direction: {row.direction}
          </p>
        ) : null}
        <RequestForm className="mt-3 space-y-3">
          {hidden}
          <label htmlFor="direction" className="block text-sm">
            What should Donna do?
          </label>
          <textarea
            id="direction"
            name="note"
            required
            maxLength={4000}
            rows={3}
            className="w-full rounded-lg border border-slate-200 p-3 text-sm"
          />
          <button
            name="action"
            value="direction"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Give direction
          </button>
        </RequestForm>
      </section>
      <section>
        <h2 className="font-semibold">Conversation and files</h2>
        <p className="mt-1 text-xs text-slate-500">
          Source excerpts below. Full mail and attachments stay in your mailbox
          and on Ripley.
        </p>
        {evidence.success
          ? evidence.data.map((e) => (
              <details
                className="mt-3 rounded-lg border bg-white p-4"
                key={e.key}
              >
                <summary className="cursor-pointer text-sm">
                  {e.from} · {e.subject}
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm">{e.excerpt}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {e.at} · {e.folder}
                </p>
                <p className="mt-2 text-xs">
                  Attachments: {e.attachments.join(", ") || "None"}
                </p>
              </details>
            ))
          : null}
      </section>
      <details className="rounded-xl border p-5">
        <summary className="cursor-pointer font-semibold">
          Update follow-up or completion
        </summary>
        <RequestForm className="mt-4 space-y-3">
          {hidden}
          <label htmlFor="work-note" className="block text-sm">
            Waiting on, next action, or evidence the work is finished
          </label>
          <textarea
            id="work-note"
            name="note"
            required
            maxLength={2000}
            className="w-full rounded-lg border border-slate-200 p-3"
          />
          <label className="block text-sm" htmlFor="follow-up">
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
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              Set follow-up
            </button>
            <button
              name="action"
              value={row.state === "handled" ? "reopen" : "complete"}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {row.state === "handled"
                ? "Reopen request"
                : "Mark finished with evidence"}
            </button>
          </div>
        </RequestForm>
      </details>
      <section>
        <h2 className="font-semibold">Activity</h2>
        <ol className="mt-3 space-y-3">
          {row.activities.map((a) => (
            <li key={a.id} className="border-l-2 pl-3 text-sm">
              <p>{a.detail}</p>
              <p className="mt-1 text-xs text-slate-500">
                {a.actor === "Donna" ? "Donna" : "You"} ·{" "}
                {a.occurredAt.toLocaleString("en-US", {
                  timeZone: "America/Chicago",
                })}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
