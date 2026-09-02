export function YouTubeIntegrationForm({
  status,
  channelName,
  channelId,
  notice,
}: {
  status: "missing" | "active" | "error";
  channelName: string | null;
  channelId: string | null;
  notice?: string | null;
}) {
  const statusLabel = status === "active" ? "Connected" : status === "error" ? "Needs attention" : "Not connected";
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">YouTube Analytics</h2>
        <p className="mt-1 text-base text-slate-500">Connect the YouTube channel used by this brand. The refresh token is encrypted and stays server-side.</p>
      </div>
      {notice === "connected" ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">YouTube is connected and analytics can refresh.</p> : null}
      {notice === "missing-refresh-token" ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Google did not return a refresh token. Reconnect and approve access when prompted.</p> : null}
      {notice === "not-configured" ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">YouTube OAuth is not configured on this environment.</p> : null}
      {notice === "no-channel" ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No YouTube channel was found for that Google account.</p> : null}
      {notice === "error" || notice === "cancelled" ? <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">YouTube was not connected. Try again.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{statusLabel}</p>
          {channelName ? <p className="mt-0.5 text-xs text-slate-500">{channelName}{channelId ? ` · ${channelId}` : ""}</p> : null}
        </div>
        <a href="/api/youtube/connect" className="ui-action-primary rounded-lg px-4 py-2 text-sm font-semibold transition">{status === "active" ? "Reconnect YouTube" : "Connect YouTube"}</a>
      </div>
    </section>
  );
}
