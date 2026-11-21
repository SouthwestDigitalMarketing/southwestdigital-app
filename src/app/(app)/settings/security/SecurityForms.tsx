"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { changePin, type SecurityFormState } from "./actions";

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.4em] tabular-nums focus:border-slate-500 focus:outline-none";

function Pin({ name, label }: { name: string; label: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        name={name}
        type="password"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete="off"
        required
        className={inputClass}
      />
    </label>
  );
}

export function ChangePinForm() {
  const [state, action, pending] = useActionState<SecurityFormState, FormData>(changePin, { error: null, done: null });
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-3">
      <Pin name="current" label="Current PIN" />
      <Pin name="pin" label="New PIN" />
      <Pin name="confirm" label="New PIN again" />
      <div className="sm:col-span-3">
        {state.error ? <p className="mb-2 text-sm text-rose-700">{state.error}</p> : null}
        {state.done ? <p className="mb-2 text-sm text-emerald-700">{state.done}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--theme-light)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Change PIN"}
        </button>
      </div>
    </form>
  );
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows computer";
  if (/Linux/.test(ua)) return "Linux computer";
  return "This device";
}

export function AddPasskeyButton({ already }: { already: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setMessage(null);
    try {
      const optionsRes = await fetch("/api/app-lock/passkey/register/options", { method: "POST" });
      if (!optionsRes.ok) throw new Error((await optionsRes.json()).error ?? "Could not start.");
      const response = await startRegistration(await optionsRes.json());
      const verifyRes = await fetch("/api/app-lock/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, name: deviceName() }),
      });
      if (!verifyRes.ok) throw new Error((await verifyRes.json()).error ?? "Could not add this device.");
      setMessage({ ok: true, text: "Face ID / fingerprint is on for this device." });
      router.refresh();
    } catch (error) {
      const text = error instanceof Error && error.name === "NotAllowedError"
        ? "Cancelled."
        : error instanceof Error ? error.message : "Could not add this device.";
      setMessage({ ok: false, text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
      >
        {busy ? "Waiting…" : already ? "Add another device" : "Set up Face ID / fingerprint on this device"}
      </button>
      {message ? (
        <p className={`mt-2 text-sm ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>{message.text}</p>
      ) : null}
    </div>
  );
}
