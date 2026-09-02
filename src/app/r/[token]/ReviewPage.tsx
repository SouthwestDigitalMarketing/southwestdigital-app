"use client";

import { useState, useTransition } from "react";
import { recordFiveStar, recordFeedback } from "./actions";

type Stage = "choice" | "feedback" | "done-stars" | "done-feedback";

export function ReviewPage({
  token,
  recipientName,
  brandName,
  lightColor,
  accentColor,
  googleReviewUrl,
}: {
  token: string;
  recipientName: string | null;
  brandName: string;
  lightColor: string;
  accentColor: string;
  googleReviewUrl: string;
}) {
  const [stage, setStage] = useState<Stage>("choice");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [pending, startTransition] = useTransition();

  const firstName = recipientName?.split(" ")[0] ?? "there";

  function handleFiveStar() {
    startTransition(async () => {
      await recordFiveStar(token);
      setStage("done-stars");
      window.location.href = googleReviewUrl;
    });
  }

  function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    startTransition(async () => {
      await recordFeedback(token, rating, feedbackText);
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

        {stage === "choice" && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
            <p className="text-xl font-semibold text-slate-900">
              Hi {firstName}! 👋
            </p>
            <p className="mt-2 text-sm text-slate-500">
              How was your experience with {brandName}?
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={handleFiveStar}
                disabled={pending}
                className="w-full rounded-full py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                ★ Leave a 5-star review
              </button>
              <button
                onClick={() => setStage("feedback")}
                disabled={pending}
                className="w-full rounded-full border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Share feedback
              </button>
            </div>
          </div>
        )}

        {stage === "feedback" && (
          <form
            onSubmit={handleFeedbackSubmit}
            className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <p className="text-center text-lg font-semibold text-slate-900">Share your feedback</p>
            <p className="mt-1 text-center text-sm text-slate-500">
              Your feedback helps us improve.
            </p>

            <div className="mt-6 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="text-3xl transition-transform hover:scale-110"
                  style={{ color: (hovered || rating) >= star ? accentColor : "#cbd5e1" }}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Tell us more (optional)…"
              rows={4}
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!rating || pending}
              className="mt-4 w-full rounded-full py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: lightColor }}
            >
              {pending ? "Submitting…" : "Submit feedback"}
            </button>
          </form>
        )}

        {stage === "done-stars" && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
            <p className="text-4xl">⭐</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">Thank you!</p>
            <p className="mt-1 text-sm text-slate-500">Redirecting you to Google…</p>
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
