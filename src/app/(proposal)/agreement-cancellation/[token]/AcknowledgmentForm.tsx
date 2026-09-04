"use client";

import { useState } from "react";

export function AcknowledgmentForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/agreement-cancellation/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to acknowledge cancellation.");
      setDone(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to acknowledge cancellation.");
    } finally {
      setPending(false);
    }
  }

  if (done) return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">Cancellation acknowledged. This signed agreement is now terminated.</div>;
  return <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><label className="block text-sm font-semibold text-slate-700">Full name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" /></label><label className="block text-sm font-semibold text-slate-700">Signer email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" /></label>{error ? <p className="text-sm text-red-700">{error}</p> : null}<button type="button" onClick={() => void submit()} disabled={pending || !name.trim() || !email.trim()} className="ui-action-primary w-full rounded-lg border px-4 py-3 text-sm font-bold disabled:opacity-40">{pending ? "Confirming…" : "Acknowledge cancellation"}</button></div>;
}
