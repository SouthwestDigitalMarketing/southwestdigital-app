import Link from "next/link";
import { requireDonna } from "@/lib/donna/access";
import { loadDesk, storageMissing } from "@/lib/donna/store";
import { mailboxHealth } from "@/lib/donna/domain";
import { addMailbox, mailboxAction } from "../actions";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const { dataContext, brand } = await requireDonna();
  let data;
  try {
    data = await loadDesk(dataContext, "needs-you");
  } catch (e) {
    if (!storageMissing(e)) throw e;
    return (
      <main className="p-6">
        Donna’s database update has not been installed here yet.
      </main>
    );
  }
  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-slate-50 text-slate-900 break-words mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <Link href="/donna" className="text-sm underline">
        ← Donna
      </Link>
      <h1 className="text-2xl font-semibold">Donna settings</h1>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Mailboxes</h2>
        {!data.mailboxes.length ? (
          <form action={addMailbox} className="mt-4 space-y-3">
            <label htmlFor="address" className="block text-sm">
              Your existing Zoho email address
            </label>
            <input
              id="address"
              name="address"
              type="email"
              required
              defaultValue="thomas@bookkeepingconroe.com"
              className="w-full rounded-lg border border-slate-200 p-3"
            />
            <p className="text-xs text-slate-500">
              Uses the existing mail connection on Ripley. Starts paused.
            </p>
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
              Add email desk
            </button>
          </form>
        ) : (
          data.mailboxes.map((m) => {
            const setupOpen =
              !!m.setupExpiresAt && m.setupExpiresAt > new Date();
            const base = process.env.PLATFORM_BASE_URL?.replace(/\/$/, "");
            const url = base
              ? `${base}/api/donna/hooks/${brand.slug}/${m.id}/${m.hookKey}`
              : null;
            return (
              <div key={m.id} className="mt-4 space-y-4">
                <p className="text-sm font-medium">
                  {m.address} · {mailboxHealth(m)}
                </p>
                <form action={mailboxAction} className="flex flex-wrap gap-3">
                  <input type="hidden" name="mailboxId" value={m.id} />
                  <button
                    name="action"
                    value={m.paused ? "resume" : "pause"}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                  >
                    {m.paused ? "Resume Donna" : "Pause Donna"}
                  </button>
                  <button
                    name="action"
                    value="check"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                  >
                    Check now
                  </button>
                </form>
                <details className="rounded-lg bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Coverage and connection details
                  </summary>
                  <p className="mt-2 text-xs text-slate-600">
                    {m.hookSecret
                      ? "Zoho notification signature registered."
                      : "Zoho incoming-mail notifications are not connected."}{" "}
                    Last worker heartbeat:{" "}
                    {m.heartbeatAt?.toLocaleString("en-US", {
                      timeZone: "America/Chicago",
                    }) ?? "Not received"}
                  </p>
                  <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs">
                    {JSON.stringify(m.coverage, null, 2)}
                  </pre>
                </details>
                <details className="rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Connect incoming-mail notifications
                  </summary>
                  <p className="mt-3 text-sm text-slate-600">
                    An operator connects Zoho’s outgoing mail webhook here.
                    Begin setup opens a private enrollment link for ten minutes.
                    Reconnecting replaces the old link.
                  </p>
                  <form action={mailboxAction} className="mt-3">
                    <input type="hidden" name="mailboxId" value={m.id} />
                    <button
                      name="action"
                      value="setup"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {m.hookSecret ? "Reconnect notifications" : "Begin setup"}
                    </button>
                  </form>
                  {setupOpen && url ? (
                    <>
                      <label
                        htmlFor="hook-url"
                        className="mt-3 block text-xs font-medium"
                      >
                        Private setup URL — do not share
                      </label>
                      <input
                        id="hook-url"
                        readOnly
                        value={url}
                        className="mt-1 w-full rounded border p-2 text-xs"
                      />
                      <p className="mt-2 text-xs text-amber-800">
                        Zoho must reach this address over public HTTPS. A local
                        dev URL cannot receive Zoho notifications.
                      </p>
                    </>
                  ) : null}
                </details>
              </div>
            );
          })
        )}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Standing rules</h2>
        <p className="mt-2 text-sm">
          Existing sender protections and filing rules remain in Mailroom. This
          first build reads and prepares work; it does not change your live mail
          rules or move messages.
        </p>
        <p className="mt-2 text-sm">
          Your direction on a request applies to that request. It does not
          silently become a rule for everyone.
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Notifications</h2>
        <p className="mt-2 text-sm">
          Needs you shows decisions and approvals. Worker failures and overdue
          follow-ups stay visible. Phone and desktop alerts are not enabled in
          this build.
        </p>
      </section>
      <p className="text-sm">
        <Link className="underline" href="/donna/legacy">
          Earlier scan findings
        </Link>
      </p>
    </main>
  );
}
