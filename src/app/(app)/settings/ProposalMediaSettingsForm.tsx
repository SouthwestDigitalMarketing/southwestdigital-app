"use client";

import { useState, useTransition } from "react";
import { Video } from "lucide-react";
import { updateProposalMediaAction } from "./actions";
import { resolveVideoEmbedUrl } from "@/app/(app)/offers/builder/OfferProposalPreview";

export function ProposalMediaSettingsForm({
  currentVideoUrl,
  currentImageUrl,
}: {
  currentVideoUrl: string | null;
  currentImageUrl: string | null;
}) {
  const [videoUrl, setVideoUrl] = useState(currentVideoUrl ?? "");
  const [imageUrl, setImageUrl] = useState(currentImageUrl ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const videoEmbedUrl = resolveVideoEmbedUrl(videoUrl);
  const videoIsInvalid = videoUrl.length > 0 && !videoEmbedUrl;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateProposalMediaAction(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Video className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Proposal Intro Media</p>
          <p className="mt-0.5 text-sm text-slate-500">
            Default video or image shown on the first screen of every proposal. Video takes priority if both are set.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {/* Video */}
        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Video URL
            <span className="ml-1.5 font-normal text-slate-400">YouTube, Vimeo, or Cloudflare Stream</span>
          </label>
          <input
            type="url"
            name="proposalFeaturedVideoUrl"
            placeholder="https://…"
            value={videoUrl}
            onChange={(e) => { setVideoUrl(e.target.value); setSaved(false); }}
            className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 ${videoIsInvalid ? "border-rose-400 focus:border-rose-400 focus:ring-rose-200" : "border-slate-300 focus:border-brandnavy focus:ring-brandnavy/20"} bg-white`}
          />
          {videoIsInvalid && (
            <p className="mt-1.5 text-xs font-semibold text-rose-600">URL not recognized as a supported video platform.</p>
          )}
          {videoEmbedUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <div className="aspect-video">
                <iframe
                  src={videoEmbedUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-semibold text-slate-700">
            Image URL
            <span className="ml-1.5 font-normal text-slate-400">JPG, PNG, WebP, or other image</span>
          </label>
          <input
            type="url"
            name="proposalFeaturedImageUrl"
            placeholder="https://…"
            value={imageUrl}
            onChange={(e) => { setImageUrl(e.target.value); setSaved(false); }}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
          />
          {imageUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Preview" className="h-auto max-h-48 w-full object-cover" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={isPending || videoIsInvalid}
          className="rounded-lg bg-brandnavy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandnavy/90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </form>
  );
}
