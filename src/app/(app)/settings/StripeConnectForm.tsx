"use client";

import { useTransition } from "react";
import { refreshStripeConnectStatusAction, startStripeConnectOnboardingAction } from "./actions";

export function StripeConnectForm({
  status,
  accountId,
  notice,
}: {
  status: "missing" | "pending" | "active" | "error";
  accountId: string | null;
  notice?: "return" | "refresh" | "connect-signup" | null;
}) {
  const [pending, startTransition] = useTransition();

  const statusLabel =
    status === "active" ? "Connected" : status === "pending" ? "Onboarding incomplete" : status === "error" ? "Needs attention" : "Not connected";

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stripe Connect</h2>
        <p className="mt-1 text-base text-slate-500">
          Connect this brand so onboarding deposits pay out to its bank. Southwest Digital is the platform; the brand does not paste API keys.
        </p>
      </div>

      {notice === "connect-signup" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Stripe Connect is not enabled on the platform account yet. In Stripe, open{" "}
          <a className="font-semibold underline" href="https://dashboard.stripe.com/test/connect" target="_blank" rel="noreferrer">
            Test mode Connect
          </a>
          , complete signup, then click Connect this brand again.
        </p>
      ) : null}
      {notice === "return" && status !== "active" ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Stripe onboarding was opened. If anything is still incomplete, continue onboarding.
        </p>
      ) : null}
      {notice === "return" && status === "active" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          This brand can receive proposal deposits.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{statusLabel}</p>
          {accountId ? <p className="mt-0.5 text-xs text-slate-500">{accountId}</p> : null}
        </div>
        <div className="flex gap-2">
          {accountId ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => refreshStripeConnectStatusAction())}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Refresh status
            </button>
          ) : null}
          <form action={startStripeConnectOnboardingAction}>
            <button
              type="submit"
              disabled={pending}
              className="ui-action-primary rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              {status === "active" ? "Update Stripe details" : "Connect this brand"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
