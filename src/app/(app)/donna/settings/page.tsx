import Link from "next/link";
import { requireDonna } from "@/lib/donna/access";
import { loadDesk, storageMissing } from "@/lib/donna/store";
import { mailboxHealth, coverageLabel } from "@/lib/donna/domain";
import { addMailbox, mailboxAction } from "../actions";
import { DonnaFrame, shortTime } from "../DonnaFrame";
export const dynamic = "force-dynamic";
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { dataContext, brand } = await requireDonna();
  const p = await searchParams;
  const section = ["mailbox", "connection", "coverage", "rules"].includes(
    p.section ?? "",
  )
    ? p.section!
    : "mailbox";
  let data;
  try {
    data = await loadDesk(dataContext, "needs-you");
  } catch (e) {
    if (!storageMissing(e)) throw e;
    return (
      <DonnaFrame active="email">
        <p>The email desk is being set up.</p>
      </DonnaFrame>
    );
  }
  const m = data.mailboxes.find((b) => b.key === "zoho") ?? data.mailboxes[0];
  const base = process.env.PLATFORM_BASE_URL?.replace(/\/$/, "");
  const url =
    m && base
      ? `${base}/api/donna/hooks/${brand.slug}/${m.id}/${m.hookKey}`
      : null;
  return (
    <DonnaFrame active="email" live={false}>
      <h2 className="text-lg font-semibold">Donna settings</h2>
      <nav aria-label="Email settings" className="flex flex-wrap gap-2">
        {["mailbox", "connection", "coverage", "rules"].map((s) => (
          <Link
            key={s}
            href={`/donna/settings?section=${s}`}
            aria-current={s === section ? "page" : undefined}
            className={`rounded-full px-3 py-2 text-xs capitalize ${s === section ? "bg-slate-900 text-white" : "bg-white text-slate-500"}`}
          >
            {s}
          </Link>
        ))}
      </nav>
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        {!m ? (
          <form action={addMailbox} className="space-y-3">
            <label htmlFor="address" className="block text-sm">
              Your existing Zoho email address
            </label>
            <input
              id="address"
              name="address"
              type="email"
              required
              defaultValue="thomas@bookkeepingconroe.com"
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
            />
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
              Add email desk
            </button>
          </form>
        ) : null}
        {m && section === "mailbox" ? (
          <>
            <h3 className="truncate text-sm font-medium">{m.address}</h3>
            <p className="text-sm text-slate-500">{mailboxHealth(m)}</p>
            <p className="text-xs text-slate-500">
              Last checked: {shortTime(m.lastCheckedAt)}
            </p>
            <form action={mailboxAction} className="flex gap-3">
              <input type="hidden" name="mailboxId" value={m.id} />
              <button
                name="action"
                value={m.paused ? "resume" : "pause"}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {m.paused ? "Resume Donna" : "Pause Donna"}
              </button>
              <button
                name="action"
                value="check"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                Check now
              </button>
            </form>
            <p className="text-xs text-slate-500">
              Reading and reply preparation only. Filing, tagging and sending
              are off.
            </p>
          </>
        ) : null}
        {m && section === "coverage" ? (
          <>
            <h3 className="text-sm font-medium">Mailbox coverage</h3>
            <p className="text-xs text-slate-500">
              {coverageLabel(m.coverage)}
            </p>
            <pre
              tabIndex={0}
              aria-label="Detailed mailbox coverage"
              className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs"
            >
              {JSON.stringify(m.coverage, null, 2)}
            </pre>
          </>
        ) : null}
        {m && section === "connection" ? (
          <>
            <h3 className="text-sm font-medium">
              Incoming email notifications
            </h3>
            <p className="text-xs text-slate-500">
              {m.hookSecret
                ? "Zoho notifications are registered."
                : "Public Zoho notifications are not connected."}
            </p>
            <form action={mailboxAction}>
              <input type="hidden" name="mailboxId" value={m.id} />
              <button
                name="action"
                value="setup"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {m.hookSecret ? "Reconnect notifications" : "Begin setup"}
              </button>
            </form>
            {m.setupExpiresAt && m.setupExpiresAt > new Date() && url ? (
              <>
                <label htmlFor="hook-url" className="block text-xs">
                  Private setup URL — expires after ten minutes
                </label>
                <input
                  id="hook-url"
                  readOnly
                  value={url}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
                <p className="text-xs text-amber-800">
                  Requires public HTTPS. This local preview cannot receive Zoho
                  webhooks.
                </p>
              </>
            ) : null}
          </>
        ) : null}
        {section === "rules" ? (
          <>
            <h3 className="text-sm font-medium">Standing rules</h3>
            <p className="text-sm text-slate-600">
              Existing sender protections remain in Mailroom. Direction on a
              request applies only to that request.
            </p>
            <p className="text-xs text-slate-500">
              Phone and desktop alerts are not enabled in this pilot.
            </p>
          </>
        ) : null}
      </section>
      <Link
        href="/donna/email"
        className="inline-block text-sm text-slate-500 underline"
      >
        Back to email
      </Link>
    </DonnaFrame>
  );
}
