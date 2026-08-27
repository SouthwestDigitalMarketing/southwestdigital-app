"use client";

import { useTransition } from "react";
import { sendReminder } from "./actions";

export function SendReminderButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await sendReminder(requestId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to send reminder");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send Reminder"}
    </button>
  );
}
