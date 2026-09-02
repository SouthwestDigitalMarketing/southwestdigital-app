"use client";

import { useState } from "react";
import { Check, Image as ImageIcon, Video } from "lucide-react";
import OfferProposalPreview, { resolveVideoEmbedUrl } from "./OfferProposalPreview";
import type { UrgencyOfferDisplay } from "./urgencyOffer";
import { PROPOSAL_THEMES, BRAND_PRIMARY_SENTINEL, BRAND_ACCENT_SENTINEL } from "./proposalThemes";
import { useBrand } from "@/lib/brands/context";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import { useProposalAssessmentDemoState } from "./ProposalCreationWorkspaceDemo";
import {
  DEFAULT_HERO_CONTINUE_BUTTON,
  DEFAULT_HERO_MEDIA_BUTTON,
  HeroButtonEditor,
  HeroVideoButtonToggle,
  normalizeHeroButton,
} from "./heroButtons";
import { resolveCoverMedia } from "./coverMedia";
import { CoverMediaPicker, type CoverMediaFolder, type CoverMediaItem } from "./CoverMediaPicker";

export type BrandMediaItem = CoverMediaItem;

const DEFAULT_HEADLINE = "Expert Real Estate Bookkeeping + Great Communication";
const DEFAULT_BODY =
  "You should not have to chase your bookkeeper or guess what your numbers mean. Your bookkeeper should help real estate investors with clean books, useful reports, and clear answers from a team that knows your business.";

export default function ProposalIntroDemo({
  mediaItems,
  mediaFolders = [],
  catalogOffer = null,
}: {
  mediaItems: BrandMediaItem[];
  mediaFolders?: CoverMediaFolder[];
  catalogOffer?: UrgencyOfferDisplay | null;
}) {
  const { assessment, updateAssessment } = useProposalAssessmentDemoState();
  const { brand } = useBrand();
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const brandDefaultVideoUrl = brand.theme?.proposalFeaturedVideoUrl ?? null;
  const brandDefaultImageUrl = brand.theme?.proposalFeaturedImageUrl ?? null;

  const selectedMediaId = assessment.featuredMediaId ?? "";

  function selectBrandDefault() {
    updateAssessment("featuredMediaId", "");
    updateAssessment("featuredVideoUrl", "");
    updateAssessment("featuredImageUrl", "");
  }

  function selectLibraryItem(item: BrandMediaItem) {
    updateAssessment("featuredMediaId", item.id);
    if (item.type === "video") {
      updateAssessment("featuredVideoUrl", item.url);
      updateAssessment("featuredImageUrl", "");
    } else {
      updateAssessment("featuredImageUrl", item.url);
      updateAssessment("featuredVideoUrl", "");
    }
  }

  function selectCustom() {
    updateAssessment("featuredMediaId", "custom");
  }

  const coverMedia = resolveCoverMedia(
    {
      featuredMediaId: assessment.featuredMediaId,
      featuredVideoUrl: assessment.featuredVideoUrl,
      featuredImageUrl: assessment.featuredImageUrl,
    },
    {
      videoUrl: brand.theme?.proposalFeaturedVideoUrl ?? null,
      imageUrl: brand.theme?.proposalFeaturedImageUrl ?? null,
    },
  );
  const hasSelectedVideo = Boolean(resolveVideoEmbedUrl(coverMedia.videoUrl));
  const selectedLibraryItem = mediaItems.find((item) => item.id === selectedMediaId);
  const selectedMediaLabel =
    selectedMediaId === "custom"
      ? "Custom URL"
      : selectedLibraryItem
        ? selectedLibraryItem.name
        : brandDefaultVideoUrl
          ? "Brand default video"
          : brandDefaultImageUrl
            ? "Brand default image"
            : "No media selected";
  const selectedMediaType = selectedLibraryItem?.type ?? (hasSelectedVideo ? "video" : coverMedia.imageUrl ? "image" : null);

  const brandPrimary = brand.theme?.proposalPrimaryColor ?? brand.theme?.primaryColor ?? "#17324d";
  const brandAccent = brand.theme?.proposalAccentColor ?? brand.theme?.accentColor ?? "#d79b3b";
  function resolveThemeColor(value: string | null, fallback: string): string {
    if (value === null) return fallback;
    if (value === BRAND_ACCENT_SENTINEL) return brandAccent;
    if (value === BRAND_PRIMARY_SENTINEL) return brandPrimary;
    return value;
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto w-full max-w-[1720px] px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader
          currentStep="intro"
          previousHref="/offers/add-ons"
          viewProposalAsNext
        />

        <div className="mt-8">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-950">Proposal Cover</h1>
            <p className="mt-1 text-sm text-slate-500">
              Customize the first screen the lead sees when they open the proposal.
            </p>

            <div className="mt-8 space-y-4">
              {/* Headline */}
              <div className="rounded-xl border border-slate-200 proposal-builder-card p-5">
                <label className="block text-sm font-semibold text-slate-700">
                  Headline
                  <span className="ml-2 font-normal text-slate-400">leave blank to use the default</span>
                </label>
                <input
                  type="text"
                  placeholder={DEFAULT_HEADLINE}
                  value={assessment.introHeadline ?? ""}
                  onChange={(e) => updateAssessment("introHeadline", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
                />
              </div>

              {/* Body */}
              <div className="rounded-xl border border-slate-200 proposal-builder-card p-5">
                <label className="block text-sm font-semibold text-slate-700">
                  Body text
                  <span className="ml-2 font-normal text-slate-400">leave blank to use the default</span>
                </label>
                <textarea
                  placeholder={DEFAULT_BODY}
                  value={assessment.introBody ?? ""}
                  onChange={(e) => updateAssessment("introBody", e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
                />
              </div>

              <div className="rounded-xl border border-slate-200 proposal-builder-card p-5">
                <p className="text-sm font-semibold text-slate-700">Cover Media</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Choose a video or image from your library. Manage folders and uploads in{" "}
                  <a href="/media" className="font-semibold text-brandnavy underline underline-offset-2">
                    Media
                  </a>
                  .
                </p>
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                    {selectedMediaType === "image" ? (
                      <ImageIcon className="h-5 w-5" />
                    ) : (
                      <Video className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{selectedMediaLabel}</p>
                    <p className="text-xs text-slate-500">
                      {selectedMediaType === "video" ? "Video" : selectedMediaType === "image" ? "Image" : "Not set"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMediaPickerOpen(true)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Choose media
                  </button>
                </div>
              </div>

              {hasSelectedVideo ? (
                <HeroVideoButtonToggle
                  value={normalizeHeroButton(assessment.heroMediaButton, DEFAULT_HERO_MEDIA_BUTTON)}
                  onChange={(next) => updateAssessment("heroMediaButton", next)}
                />
              ) : null}

              <HeroButtonEditor
                title="Continue button"
                description="Always shown. This is the main button on image-only covers, and it becomes the highlighted button after the video starts."
                value={normalizeHeroButton(assessment.heroContinueButton, DEFAULT_HERO_CONTINUE_BUTTON)}
                fallback={DEFAULT_HERO_CONTINUE_BUTTON}
                defaultIcon="arrow-right"
                onChange={(next) => updateAssessment("heroContinueButton", next)}
              />
            </div>

            {/* ── Theme picker ─────────────────────────────────────────────── */}
            <div className="mt-8">
              <p className="mb-1 text-sm font-semibold text-slate-700">Theme</p>
              <p className="mb-3 text-xs text-slate-400">
                Proposal color scheme — <span className="font-medium">Brand</span> variants use your colors from Settings
              </p>
              <div className="flex flex-wrap gap-3">
                {PROPOSAL_THEMES.map((theme) => {
                  const swatchPrimary = resolveThemeColor(theme.primary, brandPrimary);
                  const swatchAccent = resolveThemeColor(theme.accent, brandAccent);
                  const active = (assessment.proposalTheme || "brand") === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      title={theme.description}
                      onClick={() => updateAssessment("proposalTheme", theme.id)}
                      style={theme.swatchBg ? { backgroundColor: theme.swatchBg } : undefined}
                      className={`relative flex flex-col cursor-pointer items-center gap-2 rounded-xl border-2 p-2 pb-2.5 transition ${
                        active
                          ? "border-slate-900 shadow-sm"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      {/* Color preview block */}
                      <div className="relative h-10 w-16 overflow-hidden rounded-lg shadow-inner">
                        <div className="absolute inset-0" style={{ backgroundColor: swatchPrimary }} />
                        {/* Accent stripe */}
                        <div
                          className="absolute bottom-0 left-0 right-0 h-3"
                          style={{ backgroundColor: swatchAccent }}
                        />
                        {/* Check on active */}
                        {active && (
                          <div className="absolute inset-0 flex items-center justify-center pb-2">
                            <div className="rounded-full bg-white/20 p-0.5">
                              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                            </div>
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold leading-none ${
                          active ? "text-slate-900" : "text-slate-600"
                        }`}
                      >
                        {theme.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8">
              <p className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wide">Preview</p>
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <OfferProposalPreview embedded assessment={assessment} catalogOffer={catalogOffer} />
              </div>
            </div>
          </div>
        </div>
      </section>
      <CoverMediaPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        items={mediaItems}
        folders={mediaFolders}
        selectedMediaId={selectedMediaId}
        brandDefaultVideoUrl={brandDefaultVideoUrl}
        brandDefaultImageUrl={brandDefaultImageUrl}
        customVideoUrl={assessment.featuredVideoUrl ?? ""}
        customImageUrl={assessment.featuredImageUrl ?? ""}
        onSelectBrandDefault={selectBrandDefault}
        onSelectLibraryItem={selectLibraryItem}
        onSelectCustom={selectCustom}
        onCustomVideoUrlChange={(value) => updateAssessment("featuredVideoUrl", value)}
        onCustomImageUrlChange={(value) => updateAssessment("featuredImageUrl", value)}
      />
    </main>
  );
}
