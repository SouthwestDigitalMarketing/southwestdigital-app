"use client";
import { useActionState, type ReactNode } from "react";
import { requestAction } from "./actions";

export function RequestForm({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [result, action, pending] = useActionState(
    async (_previous: { ok: boolean; message: string }, form: FormData) =>
      requestAction(form),
    { ok: true, message: "" },
  );
  return (
    <form action={action} className={className}>
      <fieldset disabled={pending} className="space-y-3 disabled:opacity-60">
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
