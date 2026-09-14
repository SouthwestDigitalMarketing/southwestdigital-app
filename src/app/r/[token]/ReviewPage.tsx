"use client";

import { useEffect, useState, useTransition } from "react";
import {
  OTHER_FEEDBACK_REASON_ID,
  PRIVATE_FEEDBACK_REASONS,
  formatPrivateFeedbackText,
} from "@/lib/reviews/feedbackReasons";
import { recordFeedback, recordFiveStar, recordOpen } from "./actions";

type Stage = "rate" | "reasons" | "opening-google" | "done-feedback";

export function ReviewPage({
  token,
  recipientName,
  brandName,
  lightColor,
  accentColor,
  googleReviewUrl,
  alreadyOpened,
  alreadyLeftFeedback,
}: {
  token: string;
  recipientName: string | null;
  brandName: string;
  lightColor: string;
  accentColor: string;
  googleReviewUrl: string | null;
  alreadyOpened: boolean;
  alreadyLeftFeedback: boolean;
}) {
  const [stage, setStage] = useState<Stage>(alreadyLeftFeedback ? "done-feedback" : "rate");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [extraText, setExtraText] = useState("");
  const [pending, startTransition] = useTransition();

  const firstName = recipientName?.split(" ")[0] ?? "there";
  const otherSelected = reasonId === OTHER_FEEDBACK_REASON_ID;
  const canSubmitReasons = Boolean(reasonId) && (!otherSelected || extraText.trim().length > 0);

  useEffect(() => {
    if (alreadyOpened) return;
    void recordOpen(token);
  }, [alreadyOpened, token]);

  function handleStar(value: number) {
    if (pending) return;
    setRating(value);
    if (value === 5) {
      startTransition(async () => {
        await recordFiveStar(token);
        if (googleReviewUrl) {
          setStage("opening-google");
          window.location.href = googleReviewUrl;
          return;
        }
        setStage("done-feedback");
      });
      return;
    }
    setStage("reasons");
  }

  function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitReasons || rating < 1 || rating > 4) return;
    startTransition(async () => {
      await recordFeedback(token, rating, formatPrivateFeedbackText(reasonId ?? "", extraText) ?? "");
      setStage("done-feedback");
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-sm">
        <p
          className="text-center text-xs font-bold uppercase tracking-widest"
          style={{ color: lightColor }}
        >
          {brandName}
        </p>

        {stage === "rate" && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
            <p className="text-xl font-semibold text-slate-900">Hi {firstName}!</p>
            <p className="mt-2 text-sm text-slate-500">How would you rate {brandName}?</p>
            <div className="mt-8 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={pending}
                  onClick={() => handleStar(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="text-4xl transition-transform hover:scale-110 disabled:opacity-50"
                  style={{ color: (hovered || rating) >= star ? accentColor : "#cbd5e1" }}
                  aria-label={`Rate ${star} out of 5`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === "reasons" && (
          <form
            onSubmit={handleFeedbackSubmit}
            className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <p className="text-center text-lg font-semibold text-slate-900">Thank you for your feedback</p>
            <p className="mt-1 text-center text-sm text-slate-500">
              What kept this from being 5 stars? This stays with {brandName}.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              {PRIVATE_FEEDBACK_REASONS.map((reason) => {
                const selected = reasonId === reason.id;
                return (
                  <button
                    key={reason.id}
                    type="button"
                    disabled={pending}
                    onClick={() => setReasonId(reason.id)}
                    className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                      selected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                    aria-pressed={selected}
                  >
                    {reason.label}
                  </button>
                );
              })}
            </div>

            {otherSelected ? (
              <textarea
                value={extraText}
                onChange={(e) => setExtraText(e.target.value)}
                placeholder="Tell us more…"
                rows={4}
                maxLength={2000}
                className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
              />
            ) : null}

            <button
              type="submit"
              disabled={!canSubmitReasons || pending}
              className="mt-4 w-full rounded-full py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: lightColor }}
            >
              {pending ? "Submitting…" : "Submit"}
            </button>
          </form>
        )}

        {stage === "opening-google" && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
            <p className="text-4xl">⭐</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">Thank you!</p>
            <p className="mt-1 text-sm text-slate-500">Opening Google so you can leave that review.</p>
          </div>
        )}

        {stage === "done-feedback" && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
            <p className="text-4xl">🙏</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">Thank you!</p>
            <p className="mt-1 text-sm text-slate-500">
              We appreciate you sharing your experience.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
