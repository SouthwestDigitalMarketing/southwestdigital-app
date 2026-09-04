"use client";

import { useMemo, useState } from "react";

export type HourlyPublicViewProps = {
  proposalToken: string;
  engagementId: string | null;
  isTestProposal: boolean;
  kindLabel: string;
  clientName: string;
  brandName: string;
  brandAccent: string | null;
  contact: { name: string; email: string };
  offer: {
    catalogItemLabel: string;
    quantity: number;
    unitPrice: number;
    intakeFee: number;
    subtotal: number;
    total: number;
    amountDueNow: number;
  };
  agreementText: string;
  alreadySigned: boolean;
};

const INPUT = "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const LABEL = "block text-xs font-semibold text-slate-700";

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function HourlyPublicView(props: HourlyPublicViewProps) {
  const [signerName, setSignerName] = useState(props.contact.name);
  const [signerTitle, setSignerTitle] = useState("");
  const [email, setEmail] = useState(props.contact.email);
  const [consent, setConsent] = useState(false);
  const [readAndAgreed, setReadAndAgreed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [signState, setSignState] = useState<
    | { kind: "idle" }
    | { kind: "signing" }
    | { kind: "signed" }
    | { kind: "error"; message: string }
  >(props.alreadySigned ? { kind: "signed" } : { kind: "idle" });
  const [payState, setPayState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; clientSecret: string; amountDueNow: number }
    | { kind: "waived" }
    | { kind: "paid" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const canSubmitSignature = useMemo(
    () => Boolean(signerName.trim() && email.trim() && scrolled && readAndAgreed && consent),
    [signerName, email, scrolled, readAndAgreed, consent],
  );

  async function handleSign() {
    if (!props.engagementId || !canSubmitSignature) return;
    setSignState({ kind: "signing" });
    try {
      const response = await fetch(`/api/proposal/${props.engagementId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim(),
          email: email.trim(),
          consentToElectronicSignature: consent,
          confirmedReadAndAgreed: readAndAgreed,
          confirmedScrolledAgreement: scrolled,
        }),
      });
      if (response.ok) {
        setSignState({ kind: "signed" });
      } else {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setSignState({ kind: "error", message: data.error ?? "Sign failed" });
      }
    } catch (error) {
      setSignState({ kind: "error", message: error instanceof Error ? error.message : "Network error" });
    }
  }

  async function handleStartPayment() {
    if (!props.engagementId) return;
    setPayState({ kind: "loading" });
    try {
      const response = await fetch(`/api/proposal/${props.engagementId}/payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => ({}))) as {
        clientSecret?: string;
        amountDueNow?: number;
        waived?: boolean;
        alreadyResolved?: boolean;
        error?: string;
      };
      if (!response.ok) {
        setPayState({ kind: "error", message: data.error ?? "Payment could not be started." });
        return;
      }
      if (data.waived) {
        setPayState({ kind: "waived" });
        return;
      }
      if (data.alreadyResolved) {
        setPayState({ kind: "paid" });
        return;
      }
      if (data.clientSecret && typeof data.amountDueNow === "number") {
        setPayState({ kind: "ready", clientSecret: data.clientSecret, amountDueNow: data.amountDueNow });
        return;
      }
      setPayState({ kind: "error", message: "Unexpected response." });
    } catch (error) {
      setPayState({ kind: "error", message: error instanceof Error ? error.message : "Network error" });
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto grid w-full max-w-4xl gap-6 px-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {props.brandName} • {props.kindLabel}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Proposal for {props.clientName}
          </h1>
          {props.isTestProposal ? (
            <p className="mt-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
              Test proposal — charge will be exactly $1.00
            </p>
          ) : null}
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Your engagement</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex justify-between">
              <span>
                {props.offer.quantity} × {props.offer.catalogItemLabel}
              </span>
              <span>{money(props.offer.subtotal)}</span>
            </div>
            {props.offer.intakeFee > 0 ? (
              <div className="flex justify-between">
                <span>Intake / onboarding fee</span>
                <span>{money(props.offer.intakeFee)}</span>
              </div>
            ) : null}
            <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
              <span>Total due at signing</span>
              <span>
                {props.isTestProposal ? "$1.00 (test)" : money(props.offer.total)}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Agreement</h2>
          <div
            onScroll={(event) => {
              const target = event.currentTarget;
              const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 24;
              if (nearBottom) setScrolled(true);
            }}
            className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700"
          >
            {props.agreementText}
          </div>
          {!scrolled && signState.kind !== "signed" ? (
            <p className="mt-2 text-xs text-slate-500">Scroll to the end of the agreement to enable signing.</p>
          ) : null}
        </section>

        {signState.kind !== "signed" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Sign</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={LABEL}>
                Signer full name
                <input value={signerName} onChange={(e) => setSignerName(e.target.value)} className={INPUT} />
              </label>
              <label className={LABEL}>
                Title (optional)
                <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} className={INPUT} />
              </label>
              <label className={`${LABEL} sm:col-span-2`}>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
              </label>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={readAndAgreed} onChange={(e) => setReadAndAgreed(e.target.checked)} className="mt-0.5" />
                I have read and agree to the agreement above.
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                I consent to signing this electronically. My typed name below counts as my signature.
              </label>
            </div>
            <button
              type="button"
              onClick={handleSign}
              disabled={!canSubmitSignature || signState.kind === "signing"}
              className="ui-action-primary mt-4 inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold disabled:opacity-40"
              style={props.brandAccent ? { backgroundColor: props.brandAccent } : undefined}
            >
              {signState.kind === "signing" ? "Signing…" : "Sign agreement"}
            </button>
            {signState.kind === "error" ? (
              <p className="mt-2 text-sm text-red-700">{signState.message}</p>
            ) : null}
          </section>
        ) : null}

        {signState.kind === "signed" ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-emerald-900">Agreement signed</h2>
            <p className="mt-1 text-sm text-emerald-800">Complete payment to finalize.</p>
            {payState.kind === "idle" ? (
              <button
                type="button"
                onClick={handleStartPayment}
                className="ui-action-primary mt-4 inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold"
                style={props.brandAccent ? { backgroundColor: props.brandAccent } : undefined}
              >
                Continue to payment
              </button>
            ) : null}
            {payState.kind === "loading" ? (
              <p className="mt-4 text-sm text-emerald-800">Preparing checkout…</p>
            ) : null}
            {payState.kind === "waived" ? (
              <p className="mt-4 text-sm text-emerald-800">No payment required.</p>
            ) : null}
            {payState.kind === "paid" ? (
              <p className="mt-4 text-sm text-emerald-800">Payment complete.</p>
            ) : null}
            {payState.kind === "ready" ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  Charge amount: {money(payState.amountDueNow)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  PaymentIntent is prepared (client secret: {payState.clientSecret.slice(0, 12)}…). The full
                  Stripe Payment Element for the hourly proposal is coming in the next iteration — for now
                  this confirms Sign & Pay wiring is live end-to-end.
                </p>
              </div>
            ) : null}
            {payState.kind === "error" ? (
              <p className="mt-4 text-sm text-red-700">{payState.message}</p>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
