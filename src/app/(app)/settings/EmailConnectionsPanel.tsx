"use client";

import { useMemo, useState, useTransition } from "react";
import type { EmailConnectionProvider } from "@prisma/client";
import {
  DEFAULT_ZOHO_REGION,
  PROVIDER_INFO,
  PROVIDER_ORDER,
  ZOHO_REGIONS,
  ZOHO_REGION_ORDER,
  type ZohoRegionKey,
} from "@/lib/emailConnections/providers";
import type { PublicEmailConnection } from "@/lib/emailConnections/repository";

type Notice = "connected" | "cancelled" | "error" | "missing-refresh-token" | "not-configured" | "access-denied";

export function EmailConnectionsPanel({
  connection,
  zohoConfigured,
  notice,
}: {
  connection: PublicEmailConnection | null;
  zohoConfigured: boolean;
  notice: Notice | null;
}) {
  const [region, setRegion] = useState<ZohoRegionKey>(
    (connection?.region as ZohoRegionKey | null) ?? DEFAULT_ZOHO_REGION,
  );
  const [testTo, setTestTo] = useState("");
  const [testSubject, setTestSubject] = useState("Test email from Bookkeeping Conroe");
  const [testBody, setTestBody] = useState("Hi — this is a test email sent from the app to prove the connection works.");
  const [testStatus, setTestStatus] = useState<null | { kind: "ok" } | { kind: "error"; message: string }>(null);
  const [disconnectPending, startDisconnect] = useTransition();
  const [testPending, startTest] = useTransition();

  const notices = useMemo(() => renderNotice(notice, zohoConfigured), [notice, zohoConfigured]);

  async function handleDisconnect() {
    if (!connection) return;
    if (!confirm("Disconnect this mailbox? You can reconnect at any time.")) return;
    setTestStatus(null);
    startDisconnect(async () => {
      const response = await fetch(`/api/email-connections/${connection.id}`, { method: "DELETE" });
      if (response.ok) {
        window.location.reload();
      } else {
        alert("Couldn't disconnect. Please try again.");
      }
    });
  }

  async function handleTestSend() {
    if (!connection) return;
    setTestStatus(null);
    startTest(async () => {
      const response = await fetch(`/api/email-connections/${connection.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim(), subject: testSubject.trim(), body: testBody }),
      });
      if (response.ok) {
        setTestStatus({ kind: "ok" });
      } else {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setTestStatus({ kind: "error", message: data.error ?? "Send failed" });
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email connections</h2>
        <p className="mt-1 text-base text-slate-500">
          Connect the mailbox you already send from. Replies land in your inbox and the app can send outbound email on your behalf.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Personal connection: each staff member connects their own mailbox for this brand.
        </p>
      </div>

      {notices}

      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDER_ORDER.map((provider) => (
          <ProviderCard
            key={provider}
            provider={provider}
            connection={connection && connection.provider === provider ? connection : null}
            zohoConfigured={zohoConfigured}
            region={region}
            onRegionChange={setRegion}
          />
        ))}
      </div>

      {connection ? (
        <div className="mt-2 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                Connected: {connection.emailAddress}
                {connection.displayName ? ` (${connection.displayName})` : ""}
              </p>
              <p className="mt-0.5 text-xs text-emerald-800">
                Provider: {PROVIDER_INFO[connection.provider].label}
                {connection.region ? ` • Region: ${connection.region}` : ""}
                {" • Status: "}
                {connection.status}
              </p>
              {connection.lastError ? (
                <p className="mt-1 text-xs text-red-700">Last error: {connection.lastError}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnectPending}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {disconnectPending ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>

          <div className="space-y-2 rounded-lg border border-emerald-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Send a test message</p>
            <p className="text-xs text-slate-500">
              Sends from {connection.emailAddress}. Try your own address first, then a client to verify deliverability.
            </p>
            <label className="mt-2 block text-xs font-semibold text-slate-700">
              To
              <input
                type="email"
                value={testTo}
                onChange={(event) => setTestTo(event.target.value)}
                placeholder="you@example.com"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Subject
              <input
                type="text"
                value={testSubject}
                onChange={(event) => setTestSubject(event.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Body
              <textarea
                value={testBody}
                onChange={(event) => setTestBody(event.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            {testStatus?.kind === "ok" ? (
              <p className="text-sm text-emerald-800">Sent. Check the recipient&apos;s inbox and your Zoho Sent folder.</p>
            ) : null}
            {testStatus?.kind === "error" ? (
              <p className="text-sm text-red-700">{testStatus.message}</p>
            ) : null}
            <button
              type="button"
              onClick={handleTestSend}
              disabled={testPending || !testTo.trim()}
              className="ui-action-primary rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              {testPending ? "Sending…" : "Send test email"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ProviderCard({
  provider,
  connection,
  zohoConfigured,
  region,
  onRegionChange,
}: {
  provider: EmailConnectionProvider;
  connection: PublicEmailConnection | null;
  zohoConfigured: boolean;
  region: ZohoRegionKey;
  onRegionChange: (value: ZohoRegionKey) => void;
}) {
  const info = PROVIDER_INFO[provider];
  const isConnected = Boolean(connection);
  const comingSoon = info.status === "coming-soon";
  const disabled = comingSoon || (provider === "ZOHO" && !zohoConfigured);

  return (
    <div
      className={
        "flex flex-col gap-3 rounded-lg border p-4 " +
        (isConnected
          ? "border-emerald-300 bg-emerald-50"
          : disabled
            ? "border-slate-200 bg-slate-50"
            : "border-slate-200 bg-white")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{info.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{info.tagline}</p>
        </div>
        {comingSoon ? (
          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
            Coming soon
          </span>
        ) : isConnected ? (
          <span className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700">
            Connected
          </span>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">{info.helpText}</p>

      {provider === "ZOHO" && !disabled && !isConnected ? (
        <form method="post" action="/api/email-connections/zoho/connect" className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            Zoho region
            <select
              name="region"
              value={region}
              onChange={(event) => onRegionChange(event.target.value as ZohoRegionKey)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {ZOHO_REGION_ORDER.map((key) => (
                <option key={key} value={key}>
                  {ZOHO_REGIONS[key].label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="ui-action-primary w-full rounded-lg px-3 py-2 text-sm font-semibold"
          >
            Connect Zoho Mail
          </button>
        </form>
      ) : null}

      {provider === "ZOHO" && !zohoConfigured && !comingSoon ? (
        <p className="text-xs text-amber-700">
          Not configured yet — the platform administrator needs to set{" "}
          <code>ZOHO_MAIL_CLIENT_ID</code> and <code>ZOHO_MAIL_CLIENT_SECRET</code>.
        </p>
      ) : null}

      {comingSoon ? (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-400"
        >
          Coming soon
        </button>
      ) : null}
    </div>
  );
}

function renderNotice(notice: Notice | null, zohoConfigured: boolean) {
  if (!notice && zohoConfigured) return null;
  if (notice === "connected") {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Mailbox connected. Send a test message below to confirm end-to-end delivery.
      </p>
    );
  }
  if (notice === "cancelled") {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Connection was cancelled at Zoho. No changes were saved.
      </p>
    );
  }
  if (notice === "missing-refresh-token") {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Zoho didn&apos;t issue a refresh token. In your Zoho API Console, make sure the app is set to type &quot;Server-based&quot; and re-authorize.
      </p>
    );
  }
  if (notice === "not-configured" || !zohoConfigured) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Zoho OAuth isn&apos;t configured. See <code>docs/email-connections/zoho-setup.md</code> for the one-time setup.
      </p>
    );
  }
  if (notice === "access-denied") {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Only active brand members can connect a mailbox for this brand.
      </p>
    );
  }
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      Connection failed. Please try again.
    </p>
  );
}
