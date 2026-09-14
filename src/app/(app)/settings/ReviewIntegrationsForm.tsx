"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  disconnectQuoIntegrationAction,
  saveGoogleReviewDestinationAction,
  saveQuoIntegrationAction,
} from "./actions";

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

export function ReviewIntegrationsForm({
  quo,
  googleReviewUrl,
}: {
  quo: { connected: boolean; fromNumber: string; phoneNumberId: string };
  googleReviewUrl: string;
}) {
  const router = useRouter();
  const [quoError, setQuoError] = useState<string | null>(null);
  const [quoSaved, setQuoSaved] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleSaved, setGoogleSaved] = useState(false);
  const [quoPending, startQuo] = useTransition();
  const [googlePending, startGoogle] = useTransition();

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review requests</h2>
        <p className="mt-1 text-base text-slate-500">
          SMS from-number and Google review destination are stored per brand. The API key is encrypted and never shown again.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setQuoError(null);
          setQuoSaved(false);
          const data = new FormData(event.currentTarget);
          startQuo(async () => {
            try {
              await saveQuoIntegrationAction(data);
              setQuoSaved(true);
              router.refresh();
            } catch (err) {
              setQuoError(err instanceof Error ? err.message : "Could not save SMS settings");
            }
          });
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">
            SMS {quo.connected ? "connected" : "not configured"}
          </p>
          {quo.connected ? (
            <button
              type="button"
              disabled={quoPending}
              onClick={() => {
                setQuoError(null);
                startQuo(async () => {
                  try {
                    await disconnectQuoIntegrationAction();
                    router.refresh();
                  } catch (err) {
                    setQuoError(err instanceof Error ? err.message : "Could not disconnect SMS");
                  }
                });
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Disconnect
            </button>
          ) : null}
        </div>
        <div>
          <label htmlFor="quo-from-number" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            SMS from-number
          </label>
          <input
            id="quo-from-number"
            name="fromNumber"
            type="tel"
            required
            defaultValue={quo.fromNumber}
            placeholder="+15551234567"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="quo-phone-number-id" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Quo phone number ID (optional)
          </label>
          <input
            id="quo-phone-number-id"
            name="phoneNumberId"
            type="text"
            defaultValue={quo.phoneNumberId}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="quo-api-key" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Quo API key
          </label>
          <input
            id="quo-api-key"
            name="apiKey"
            type="password"
            autoComplete="new-password"
            placeholder={quo.connected ? "Leave blank to keep the saved key" : ""}
            required={!quo.connected}
            className={inputClass}
          />
        </div>
        {quoError ? <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{quoError}</p> : null}
        {quoSaved ? <p className="text-xs text-emerald-700">SMS settings saved.</p> : null}
        <button
          type="submit"
          disabled={quoPending}
          className="ui-action-primary rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {quoPending ? "Saving…" : "Save SMS settings"}
        </button>
      </form>

      <form
        className="space-y-4 border-t border-slate-100 pt-6"
        onSubmit={(event) => {
          event.preventDefault();
          setGoogleError(null);
          setGoogleSaved(false);
          const data = new FormData(event.currentTarget);
          startGoogle(async () => {
            try {
              await saveGoogleReviewDestinationAction(data);
              setGoogleSaved(true);
              router.refresh();
            } catch (err) {
              setGoogleError(err instanceof Error ? err.message : "Could not save Google review URL");
            }
          });
        }}
      >
        <div>
          <label htmlFor="google-review-url" className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Google review URL
          </label>
          <input
            id="google-review-url"
            name="googleReviewUrl"
            type="url"
            defaultValue={googleReviewUrl}
            placeholder="https://"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">Clear and save to hide the public Google button for this brand.</p>
        </div>
        {googleError ? <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{googleError}</p> : null}
        {googleSaved ? <p className="text-xs text-emerald-700">Google review URL saved.</p> : null}
        <button
          type="submit"
          disabled={googlePending}
          className="ui-action-primary rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {googlePending ? "Saving…" : "Save Google review URL"}
        </button>
      </form>
    </section>
  );
}
