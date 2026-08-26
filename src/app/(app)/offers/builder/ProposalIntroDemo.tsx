"use client";

import { Check, Image, Sparkles, Video, Link2 } from "lucide-react";
import { resolveVideoEmbedUrl } from "./OfferProposalPreview";
import { getProposalTheme, PROPOSAL_THEMES } from "./proposalThemes";
import { useBrand } from "@/lib/brands/context";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import PricingSnapshotSidebar from "./PricingSnapshotSidebar";
import {
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotItems,
  useProposalAssessmentDemoState,
} from "./ProposalCreationWorkspaceDemo";

export type BrandMediaItem = {
  id: string;
  name: string;
  type: string;
  url: string;
};

const DEFAULT_HEADLINE = "Expert Real Estate Bookkeeping + Great Communication";
const DEFAULT_BODY =
  "You should not have to chase your bookkeeper or guess what your numbers mean. Your bookkeeper should help real estate investors with clean books, useful reports, and clear answers from a team that knows your business.";

export default function ProposalIntroDemo({ mediaItems }: { mediaItems: BrandMediaItem[] }) {
  const { assessment, updateAssessment } = useProposalAssessmentDemoState();
  const { brand } = useBrand();
  const pricingItems = getProposalPricingSnapshotItems(assessment);
  const cleanupCard = getProposalPricingSnapshotCleanupCard(assessment);

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

  // Resolve preview values
  const previewVideoUrl =
    selectedMediaId === "" ? brandDefaultVideoUrl ?? "" : assessment.featuredVideoUrl ?? "";
  const previewImageUrl =
    selectedMediaId === "" ? brandDefaultImageUrl ?? "" : assessment.featuredImageUrl ?? "";
  const previewEmbedUrl = resolveVideoEmbedUrl(previewVideoUrl);
  const hasMedia = !!(previewEmbedUrl || previewImageUrl);
  const customHeadline = assessment.introHeadline?.trim() || null;
  const customBody = assessment.introBody?.trim() || null;

  // Theme
  const selectedTheme = getProposalTheme(assessment.proposalTheme || "brand");
  const previewPrimary = selectedTheme.primary ?? (brand.theme?.primaryColor ?? "#17324d");
  const previewAccent = selectedTheme.accent ?? (brand.theme?.accentColor ?? "#d79b3b");

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto w-full max-w-[1720px] px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader
          currentStep="intro"
          previousHref="/offers/add-ons"
          viewProposalAsNext
        />

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_440px] 2xl:grid-cols-[minmax(0,1.55fr)_470px]">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-950">Proposal Intro</h1>
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

              {/* Media picker */}
              <div className="rounded-xl border border-slate-200 proposal-builder-card p-5">
                <p className="text-sm font-semibold text-slate-700">Intro Media</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Video or image shown on the first screen. Video takes priority over image.
                  Manage your library in{" "}
                  <a href="/media" className="font-semibold text-brandnavy underline underline-offset-2">
                    Media
                  </a>
                  .
                </p>

                <div className="mt-3 space-y-2">
                  <MediaOption
                    selected={selectedMediaId === ""}
                    onClick={selectBrandDefault}
                    icon={<Sparkles className="h-4 w-4" />}
                    label="Use brand default"
                    sub={
                      brandDefaultVideoUrl
                        ? "Video set in Settings"
                        : brandDefaultImageUrl
                          ? "Image set in Settings"
                          : "No brand default set"
                    }
                  />

                  {mediaItems.map((item) => (
                    <MediaOption
                      key={item.id}
                      selected={selectedMediaId === item.id}
                      onClick={() => selectLibraryItem(item)}
                      icon={
                        item.type === "video" ? (
                          <Video className="h-4 w-4" />
                        ) : (
                          <Image className="h-4 w-4" />
                        )
                      }
                      label={item.name}
                      sub={item.type === "video" ? "Video" : "Image"}
                    />
                  ))}

                  <MediaOption
                    selected={selectedMediaId === "custom"}
                    onClick={selectCustom}
                    icon={<Link2 className="h-4 w-4" />}
                    label="Custom URL"
                    sub="Enter a URL directly"
                  />
                </div>

                {/* Custom URL inputs */}
                {selectedMediaId === "custom" && (
                  <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600">
                        Video URL
                        <span className="ml-1.5 font-normal text-slate-400">
                          YouTube, Vimeo, or Cloudflare Stream
                        </span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://…"
                        value={assessment.featuredVideoUrl ?? ""}
                        onChange={(e) => updateAssessment("featuredVideoUrl", e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600">
                        Image URL
                        <span className="ml-1.5 font-normal text-slate-400">JPG, PNG, WebP, etc.</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://…"
                        value={assessment.featuredImageUrl ?? ""}
                        onChange={(e) => updateAssessment("featuredImageUrl", e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Theme picker ─────────────────────────────────────────────── */}
            <div className="mt-8">
              <p className="mb-1 text-sm font-semibold text-slate-700">Theme</p>
              <p className="mb-3 text-xs text-slate-400">
                Proposal color scheme — <span className="font-medium">Brand</span> uses your colors from Settings
              </p>
              <div className="flex flex-wrap gap-3">
                {PROPOSAL_THEMES.map((theme) => {
                  const swatchPrimary = theme.primary ?? (brand.theme?.primaryColor ?? "#17324d");
                  const swatchAccent = theme.accent ?? (brand.theme?.accentColor ?? "#d79b3b");
                  const active = (assessment.proposalTheme || "brand") === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      title={theme.description}
                      onClick={() => updateAssessment("proposalTheme", theme.id)}
                      className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-2 pb-2.5 transition ${
                        active
                          ? "border-brandnavy shadow-sm"
                          : "border-slate-200 hover:border-slate-300"
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
                          active ? "text-brandnavy" : "text-slate-600"
                        }`}
                      >
                        {theme.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Intro screen preview ─────────────────────────────────────── */}
            <div className="mt-8">
              <p className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wide">Preview</p>
              <div
                className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
                style={{
                  "--brand-primary": previewPrimary,
                  "--brand-accent": previewAccent,
                  "--brand-ink": previewPrimary,
                  "--color-accent-500": previewAccent,
                  "--color-accent-100": `color-mix(in srgb, ${previewAccent} 15%, white)`,
                } as React.CSSProperties}
              >
                {/* Mock proposal nav */}
                <div className="border-b border-slate-200 bg-white px-5 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="w-16 rounded-lg border border-slate-200 px-3 py-1.5 text-center text-xs font-semibold text-slate-300">
                      Back
                    </span>
                    <ol className="flex items-center">
                      {["Intro", "Services", "Done"].map((label, i) => (
                        <li key={label} className="flex items-center">
                          {i > 0 && <span className="h-0.5 w-6 bg-slate-200" />}
                          <div className="w-14 text-center">
                            <span
                              className={`mx-auto grid h-7 w-7 place-items-center rounded-full border text-xs font-bold ${
                                i === 0
                                  ? "border-brandnavy bg-brandnavy text-white"
                                  : "border-slate-200 bg-white text-slate-400"
                              }`}
                            >
                              {i + 1}
                            </span>
                            <span className="mt-1 block text-xs text-slate-400">{label}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <span
                      className="inline-flex items-center gap-1 rounded-lg border-2 px-3 py-1.5 text-xs font-bold text-white"
                      style={{
                        borderColor: "var(--brand-accent, #d79b3b)",
                        backgroundColor: "var(--brand-primary, #17324d)",
                      }}
                    >
                      Next →
                    </span>
                  </div>
                </div>

                {/* Intro content */}
                <div className="px-6 py-10 sm:px-10" style={{ background: selectedTheme.pageBg }}>
                  <div
                    className={`mx-auto grid max-w-4xl items-center gap-8 ${hasMedia ? "md:grid-cols-2" : ""}`}
                  >
                    <div>
                      <h2
                        className="text-2xl font-bold tracking-tight sm:text-3xl"
                        style={{ color: "var(--brand-primary, #17324d)" }}
                      >
                        {customHeadline ?? (
                          <>
                            Expert{" "}
                            <span style={{ color: "var(--brand-accent, #d79b3b)" }}>
                              Real Estate
                            </span>{" "}
                            Bookkeeping + Great{" "}
                            <span style={{ color: "var(--brand-accent, #d79b3b)" }}>
                              Communication
                            </span>
                          </>
                        )}
                      </h2>
                      <p className="mt-4 text-sm leading-7 text-slate-600">
                        {customBody ??
                          `You should not have to chase your bookkeeper or guess what your numbers mean. ${brand.name} helps real estate investors with clean books, useful reports, and clear answers from a team that knows your business.`}
                      </p>
                      <div className="mt-6">
                        <span
                          className="inline-flex cursor-default items-center gap-1.5 rounded-lg border-2 px-5 py-2.5 text-sm font-bold text-white"
                          style={{
                            borderColor: "var(--brand-accent, #d79b3b)",
                            backgroundColor: "var(--brand-primary, #17324d)",
                          }}
                        >
                          View your options →
                        </span>
                      </div>
                    </div>

                    {previewEmbedUrl ? (
                      <div
                        className="overflow-hidden rounded-xl border shadow-sm"
                        style={{ borderColor: "#cbd5e1" }}
                      >
                        <div className="aspect-video">
                          <iframe
                            src={previewEmbedUrl}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="h-full w-full"
                          />
                        </div>
                      </div>
                    ) : previewImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewImageUrl}
                        alt=""
                        className="max-h-64 w-full rounded-xl border object-cover shadow-sm"
                        style={{ borderColor: "#cbd5e1" }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <PricingSnapshotSidebar items={pricingItems} cleanupCard={cleanupCard} />
        </div>
      </section>
    </main>
  );
}

function MediaOption({
  selected,
  onClick,
  icon,
  label,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
        selected
          ? "border-brandnavy bg-brandnavy-50/30 text-brandnavy"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
    >
      <span className={`shrink-0 ${selected ? "text-brandnavy" : "text-slate-400"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{label}</span>
        {sub && <span className="block text-xs text-slate-400">{sub}</span>}
      </span>
      <span
        className={`h-4 w-4 shrink-0 rounded-full border-2 transition ${
          selected ? "border-brandnavy bg-brandnavy" : "border-slate-300"
        }`}
      />
    </button>
  );
}
