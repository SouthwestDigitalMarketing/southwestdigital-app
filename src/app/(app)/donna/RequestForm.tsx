"use client";
import { useActionState, useSyncExternalStore, type ReactNode } from "react";
import { requestAction } from "./actions";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function RequestForm({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [result, action, pending] = useActionState(
    async (_previous: { ok: boolean; message: string }, form: FormData) =>
      requestAction(form),
    { ok: true, message: "" },
  );
  return (
    <form action={action} className={className}>
      <fieldset
        disabled={pending || !hydrated}
        className="space-y-3 disabled:opacity-60"
      >
        {children}
      </fieldset>
      {result.message ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={`mt-2 text-sm ${result.ok ? "text-emerald-800" : "text-red-700"}`}
        >
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
