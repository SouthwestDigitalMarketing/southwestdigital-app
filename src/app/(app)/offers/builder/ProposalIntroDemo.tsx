"use client";

import { useState } from "react";
import { Check, Image as ImageIcon, Video } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { resolveVideoEmbedUrl } from "./OfferProposalPreview";

// Load the preview client-only. Its state is entirely localStorage-backed
// (contact info + assessment), so SSR would render defaults and then re-render
// with real data — causing a flash. Client-only rendering skips SSR for this
// subtree so the first paint already reflects stored state.
const OfferProposalPreview = dynamic(() => import("./OfferProposalPreview"), {
  ssr: false,
  loading: () => <div className="min-h-[40rem]" />,
});
import type { UrgencyOfferDisplay } from "./urgencyOffer";
import { PROPOSAL_THEMES, DEFAULT_PROPOSAL_THEME_ID, DEFAULT_PROPOSAL_MODE, type ProposalMode } from "./proposalThemes";
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
import type { AgreementTemplateOption } from "@/lib/agreements/types";

export type BrandMediaItem = CoverMediaItem;

const DEFAULT_HEADLINE = "Expert Real Estate Bookkeeping + Great Communication";
const DEFAULT_BODY =
  "You should not have to chase your bookkeeper or guess what your numbers mean. Your bookkeeper should help real estate investors with clean books, useful reports, and clear answers from a team that knows your business.";

export default function ProposalIntroDemo({
  mediaItems,
  mediaFolders = [],
  catalogOffer = null,
  agreementTemplates,
}: {
  mediaItems: BrandMediaItem[];
  mediaFolders?: CoverMediaFolder[];
  catalogOffer?: UrgencyOfferDisplay | null;
  agreementTemplates: AgreementTemplateOption[];
}) {
  const { assessment, updateAssessment } = useProposalAssessmentDemoState();
  const { brand } = useBrand();
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const selectedAgreement =
    agreementTemplates.find((template) => template.id === assessment.agreementTemplateId)
    ?? agreementTemplates.find((template) => template.isDefault)
    ?? agreementTemplates[0]
    ?? null;

  function selectAgreement(templateId: string) {
    const template = agreementTemplates.find((item) => item.id === templateId);
    if (!template) return;
    updateAssessment("agreementTemplateId", template.id);
    updateAssessment("agreementTemplateName", template.name);
    updateAssessment("agreementTemplateContent", template.content);
  }

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

  const brandLight = brand.theme?.proposalLightColor ?? brand.theme?.lightColor ?? "#17324d";
  const brandAccent = brand.theme?.proposalAccentColor ?? brand.theme?.accentColor ?? "#d79b3b";
  function resolveThemeColor(value: string | null, fallback: string): string {
    return value ?? fallback;
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
                    className="ui-action-secondary rounded-lg border px-3 py-2 text-sm font-semibold transition"
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
            {(() => {
              const proposalMode: ProposalMode = assessment.proposalMode ?? DEFAULT_PROPOSAL_MODE;
              return (
            <div className="mt-8 rounded-xl border border-slate-200 proposal-builder-card p-5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Theme</p>
                  <p className="text-xs text-slate-400">
                    Proposal color scheme — <span className="font-medium">Brand</span> uses your colors from Settings
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium text-slate-700">
                  <span className={proposalMode === "light" ? "text-slate-900" : "text-slate-500"}>Light</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={proposalMode === "dark"}
                    aria-label="Toggle proposal dark mode"
                    onClick={() => updateAssessment("proposalMode", proposalMode === "dark" ? "light" : "dark")}
                    className="ui-toggle-switch"
                  >
                    <span className="ui-toggle-switch-thumb" />
                  </button>
                  <span className={proposalMode === "dark" ? "text-slate-900" : "text-slate-500"}>Dark</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {PROPOSAL_THEMES.map((theme) => {
                  const themeLight = proposalMode === "dark" && theme.darkLight ? theme.darkLight : theme.light;
                  const themeAccent = proposalMode === "dark" && theme.darkAccent ? theme.darkAccent : theme.accent;
                  const swatchLight = resolveThemeColor(themeLight, brandLight);
                  const swatchAccent = resolveThemeColor(themeAccent, brandAccent);
                  const active = (assessment.proposalTheme || DEFAULT_PROPOSAL_THEME_ID) === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      title={theme.description}
                      onClick={() => updateAssessment("proposalTheme", theme.id)}
                      className={`relative flex flex-col cursor-pointer items-center gap-2 rounded-xl border-2 p-2 pb-2.5 transition ${
                        active
                          ? "border-brandnavy shadow-sm"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      {/* Color preview block — primary | pageBg (current mode) | accent */}
                      <div className="relative flex h-10 w-16 overflow-hidden rounded-lg shadow-inner">
                        <div className="flex-1" style={{ backgroundColor: swatchLight }} />
                        <div className="flex-1" style={{ background: theme.pageBg[proposalMode] }} />
                        <div className="flex-1" style={{ backgroundColor: swatchAccent }} />
                        {active && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-full bg-white/90 p-0.5 shadow-sm">
                              <Check className="h-3 w-3 text-slate-900" strokeWidth={3} />
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-semibold leading-none">
                        {theme.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
              );
            })()}

            <div className="mt-8">
              <div className="mb-6 rounded-xl border border-slate-200 proposal-builder-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <label htmlFor="agreement-template" className="block text-sm font-semibold text-slate-700">
                      Agreement template
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      The client reviews and signs this agreement before paying. Publishing saves a copy with this offer.
                    </p>
                  </div>
                  <Link
                    href="/agreements"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Manage templates
                  </Link>
                </div>
                <select
                  id="agreement-template"
                  value={selectedAgreement?.id ?? ""}
                  onChange={(event) => selectAgreement(event.target.value)}
                  className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/20"
                >
                  {agreementTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}{template.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
                {selectedAgreement?.description ? (
                  <p className="mt-2 text-xs text-slate-500">{selectedAgreement.description}</p>
                ) : null}
              </div>
              <p className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wide">Preview</p>
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <OfferProposalPreview
                  embedded
                  assessment={assessment}
                  catalogOffer={catalogOffer}
                  agreementTemplate={selectedAgreement}
                />
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
