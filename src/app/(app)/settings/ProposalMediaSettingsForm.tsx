"use client";

import { useRef, useState, useTransition } from "react";
import { Video } from "lucide-react";
import { updateProposalMediaAction } from "./actions";
import { resolveFeaturedMedia } from "@/app/(app)/offers/builder/OfferProposalPreview";

export function ProposalMediaSettingsForm({ currentUrl }: { currentUrl: string | null }) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const media = resolveFeaturedMedia(url);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateProposalMediaAction(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Video className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Proposal Intro Media</p>
          <p className="mt-0.5 text-sm text-slate-500">
            Image or video shown on the first screen of every proposal. Paste an image URL, YouTube link, or Vimeo link.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <label className="block text-sm font-semibold text-slate-700">
          Media URL
          <input
            type="url"
            name="proposalFeaturedMediaUrl"
            placeholder="https://…"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
          />
        </label>

        {url && media && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            {media.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.url} alt="Preview" className="h-auto max-h-56 w-full object-cover" />
            ) : (
              <div className="aspect-video">
                <iframe
                  src={media.embedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            )}
          </div>
        )}

        {url && !media && (
          <p className="mt-2 text-xs font-semibold text-rose-600">Could not parse this URL as an image or video.</p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        {url ? (
          <button
            type="button"
            onClick={() => { setUrl(""); setSaved(false); }}
            className="text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            Clear
          </button>
        ) : <span />}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brandnavy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandnavy/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </form>
  );
}
