import { redirect } from "next/navigation";
import { requireAppBrand } from "@/lib/brands/staff";
import { bridgeView, loadBridge, type BridgeView } from "@/lib/operations/bridge";
import { LiveRefresh } from "@/app/(app)/dashboard/_scorecard/LiveRefresh";
import { toggleBridge } from "./actions";

export const dynamic = "force-dynamic";

const STATE: Record<BridgeView["state"], { label: string; detail: string; dot: string }> = {
  off: { label: "Off", detail: "Ripley is not checking Gmail.", dot: "bg-slate-400" },
  "turning-on": { label: "Turning on", detail: "Ripley picks this up within about 30 seconds.", dot: "bg-amber-400" },
  "turning-off": { label: "Turning off", detail: "Ripley stops checking Gmail within about 30 seconds.", dot: "bg-amber-400" },
  active: { label: "On, fast", detail: "Checking Gmail every 10 seconds (a ChatGPT exchange is going).", dot: "bg-emerald-500" },
  idle: { label: "On, idle", detail: "Checking Gmail every 60 seconds; a new message switches back to fast.", dot: "bg-emerald-500" },
  error: { label: "On, but failing", detail: "Ripley cannot reach Gmail right now and keeps retrying.", dot: "bg-red-500" },
  "not-answering": { label: "Ripley not answering", detail: "The switch is on, but ripley has not checked in for 3 minutes.", dot: "bg-red-500" },
};

function ago(date: Date | null, now: Date) {
  if (!date) return "never";
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 90) return `${s} s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  return date.toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function BridgePage() {
  const { isPlatformOperator } = await requireAppBrand();
  if (!isPlatformOperator) redirect("/settings");
  const now = new Date();
  const view = bridgeView(await loadBridge(), now);
  const state = STATE[view.state];

  return (
    <div className="w-full max-w-2xl space-y-6 p-4 sm:p-6 lg:p-8">
      <LiveRefresh seconds={10} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ChatGPT bridge</h1>
        <p className="mt-1 text-sm text-slate-500">
          Turn it on before a ChatGPT Voice session so your messages reach the Herdr agents. Turn it off after.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 shrink-0 rounded-full ${state.dot}`} aria-hidden />
          <h2 className="text-lg font-semibold text-slate-900">{state.label}</h2>
        </div>
        <p className="mt-1 text-sm text-slate-600">{state.detail}</p>
        <form action={toggleBridge} className="mt-5">
          <input type="hidden" name="enabled" value={view.enabled ? "off" : "on"} />
          <button
            type="submit"
            className={
              view.enabled
                ? "w-full rounded-full border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50"
                : "w-full rounded-full bg-[var(--theme-light)] px-5 py-3 text-base font-semibold text-white hover:opacity-90"
            }
          >
            {view.enabled ? "Turn off" : "Turn on"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Ripley checked in</dt>
          <dd className="text-slate-900">{ago(view.heartbeatAt, now)}</dd>
          <dt className="text-slate-500">Last Gmail check</dt>
          <dd className="text-slate-900">{ago(view.lastCheckAt, now)}</dd>
          <dt className="text-slate-500">Last bridge message</dt>
          <dd className="text-slate-900">
            {ago(view.lastMessageAt, now)}
            {view.lastMessageUid ? <span className="text-slate-500"> (Gmail #{view.lastMessageUid})</span> : null}
          </dd>
          <dt className="text-slate-500">Switched</dt>
          <dd className="text-slate-900">
            {view.changedAt ? `${view.enabled ? "on" : "off"} ${ago(view.changedAt, now)}` : "never"}
            {view.changedBy ? <span className="text-slate-500"> by {view.changedBy}</span> : null}
          </dd>
          {view.lastError ? (
            <>
              <dt className="text-slate-500">Last error</dt>
              <dd className="break-words text-red-700">{view.lastError}</dd>
            </>
          ) : null}
        </dl>
      </section>
    </div>
  );
}
