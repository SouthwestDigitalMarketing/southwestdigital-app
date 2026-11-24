"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestNewsletterUndo } from "../reviewActions";

export function UndoClear() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <p className="mt-6 text-sm text-slate-600">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              setMessage((await requestNewsletterUndo()).message);
              router.refresh();
            } catch {
              setMessage("Could not send the undo. Try again.");
            }
          })
        }
        className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 disabled:opacity-50"
      >
        Undo last clear
      </button>
      <span> — mail back from Trash, senders off the always-spam list. Unsubscribes already sent stay sent.</span>
      {message ? <span className="block" role="status">{message}</span> : null}
    </p>
  );
}
