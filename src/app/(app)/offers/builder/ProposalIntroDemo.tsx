"use client";

import { Check, Image, Sparkles, Video, Link2 } from "lucide-react";
import OfferProposalPreview from "./OfferProposalPreview";
import { PROPOSAL_THEMES, BRAND_PRIMARY_SENTINEL, BRAND_ACCENT_SENTINEL } from "./proposalThemes";
import { useBrand } from "@/lib/brands/context";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import { useProposalAssessmentDemoState } from "./ProposalCreationWorkspaceDemo";

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

              {/* Media picker */}
              <div className="rounded-xl border border-slate-200 proposal-builder-card p-5">
                <p className="text-sm font-semibold text-slate-700">Cover Media</p>
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
                <OfferProposalPreview embedded assessment={assessment} />
              </div>
            </div>
          </div>
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
