"use client";

import { useActionState, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { createPin, forgotPin, unlockWithPin, type UnlockFormState } from "./actions";

const pinInputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.5em] tabular-nums outline-none ring-[var(--theme-accent)] focus:ring-2";

function PinInput({ name, label, autoFocus }: { name: string; label: string; autoFocus?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        name={name}
        type="password"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete="off"
        required
        autoFocus={autoFocus}
        className={`mt-1.5 ${pinInputClass}`}
      />
    </label>
  );
}

async function unlockWithPasskey(): Promise<string | null> {
  const optionsRes = await fetch("/api/app-lock/passkey/auth/options", { method: "POST" });
  if (!optionsRes.ok) return "Face ID / fingerprint is not set up on this device.";
  let response;
  try {
    response = await startAuthentication(await optionsRes.json());
  } catch {
    return "Face ID / fingerprint was cancelled.";
  }
  const verifyRes = await fetch("/api/app-lock/passkey/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(response),
  });
  return verifyRes.ok ? null : "Face ID / fingerprint did not match. Use your PIN.";
}

export function UnlockForm({ mode, next, passkeys }: { mode: "unlock" | "create"; next: string; passkeys: boolean }) {
  const [state, action, pending] = useActionState<UnlockFormState, FormData>(
    mode === "unlock" ? unlockWithPin : createPin,
    { error: null },
  );
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const error = passkeyError ?? state.error;

  return (
    <div className="mt-6 space-y-4">
      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {mode === "unlock" && passkeys ? (
        <button
          type="button"
          disabled={passkeyBusy}
          onClick={async () => {
            setPasskeyBusy(true);
            const problem = await unlockWithPasskey();
            setPasskeyBusy(false);
            if (problem) setPasskeyError(problem);
            else window.location.assign(next);
          }}
          className="w-full cursor-pointer rounded-full border border-slate-300 px-5 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {passkeyBusy ? "Waiting…" : "Use Face ID / fingerprint"}
        </button>
      ) : null}
      <form action={action} onSubmit={() => setPasskeyError(null)} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <PinInput name="pin" label={mode === "unlock" ? "PIN" : "New PIN (6 digits)"} autoFocus={!passkeys} />
        {mode === "create" ? <PinInput name="confirm" label="Type it again" /> : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full cursor-pointer rounded-full bg-[var(--theme-light)] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Checking…" : mode === "unlock" ? "Unlock" : "Save PIN"}
        </button>
      </form>
      {mode === "unlock" ? (
        <form action={forgotPin} className="text-center">
          <button type="submit" className="text-sm font-medium text-slate-500 underline hover:text-slate-700">
            Forgot PIN? Sign in again to set a new one
          </button>
        </form>
      ) : null}
    </div>
  );
}
